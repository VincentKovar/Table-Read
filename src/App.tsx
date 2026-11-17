import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type {
  AudioClip,
  CharacterVoiceProfile,
  ExportFormat,
  PlaybackStatus,
  ScriptBlock,
  VoiceName,
} from './types/script';
import { NARRATOR_KEY } from './constants/voices';
import { SAMPLE_SCRIPTS } from './data/sampleScripts';
import {
  buildCastProfiles,
  formatBlocksToRawScript,
  parseFdxXml,
  parseScriptText,
} from './utils/scriptParser';
import {
  concatenatePcmSegments,
  decodeWavBase64ToPcm,
  encodePcmToMp3,
  encodePcmToWav,
} from './utils/audioConcat';
import { TopBar, type WorkspaceSection } from './components/TopBar';
import { ManuscriptView } from './components/ManuscriptView';
import { TransportPanel } from './components/TransportPanel';
import { CastPanel } from './components/CastPanel';
import { ExportPanel } from './components/ExportPanel';
import { ScriptEditorModal } from './components/ScriptEditorModal';

function makeCacheKey(
  voiceName: VoiceName,
  persona: string,
  emotion: string,
  text: string
): string {
  return `${voiceName}::${persona.trim()}::${emotion.trim()}::${text.trim()}`;
}

function slugifyFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'table-read'
  );
}

export default function App() {
  const initialSample = SAMPLE_SCRIPTS[0];
  const initialParsed = useMemo(
    () => parseScriptText(initialSample.rawText, initialSample.title),
    [initialSample]
  );

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('manuscript');
  const [activeSampleId, setActiveSampleId] = useState<string | null>(initialSample.id);
  const [scriptTitle, setScriptTitle] = useState<string>(initialParsed.title);
  const [blocks, setBlocks] = useState<ScriptBlock[]>(initialParsed.blocks);
  const [castProfiles, setCastProfiles] = useState<Record<string, CharacterVoiceProfile>>(
    () => buildCastProfiles(initialParsed.blocks, {}, initialSample.defaultVoices)
  );
  const [includeStageDirections, setIncludeStageDirections] = useState<boolean>(false);

  // Editor modal
  const [editorModalOpen, setEditorModalOpen] = useState<boolean>(false);
  const [editorModalMode, setEditorModalMode] = useState<'paste' | 'import'>('paste');

  // Audio cache & synthesis state
  const [audioCache, setAudioCache] = useState<Record<string, AudioClip>>({});
  const audioCacheRef = useRef<Record<string, AudioClip>>({});
  const [synthesizingBlockIds, setSynthesizingBlockIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [auditioningCharacter, setAuditioningCharacter] = useState<string | null>(null);
  const [isTaggingEmotions, setIsTaggingEmotions] = useState<boolean>(false);

  // Playback state
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [lineProgress, setLineProgress] = useState<number>(0);
  const [lineDurationSeconds, setLineDurationSeconds] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [pauseGapMs, setPauseGapMs] = useState<number>(400);

  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp3');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
  const [masterFileName, setMasterFileName] = useState<string | null>(null);

  // Error feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const continuousModeRef = useRef<boolean>(false);

  useEffect(() => {
    audioCacheRef.current = audioCache;
  }, [audioCache]);

  useEffect(() => {
    return () => {
      if (masterAudioUrl) {
        URL.revokeObjectURL(masterAudioUrl);
      }
    };
  }, [masterAudioUrl]);

  const playableBlocks = useMemo(
    () =>
      blocks.filter(
        (b) => b.type === 'dialogue' || includeStageDirections
      ),
    [blocks, includeStageDirections]
  );

  const getBlockVoiceConfig = useCallback(
    (block: ScriptBlock): { voiceName: VoiceName; persona: string; emotion: string } => {
      const speakerKey =
        block.type === 'dialogue' ? block.character || 'SPEAKER' : NARRATOR_KEY;
      const profile = castProfiles[speakerKey];
      const voiceName: VoiceName = profile?.voiceName || 'Kore';
      const persona =
        profile?.persona ||
        (block.type === 'dialogue'
          ? 'Natural theatrical table read'
          : 'Crisp, unobtrusive narrator');
      const emotion =
        block.type === 'dialogue'
          ? block.emotion || 'Neutral'
          : block.type === 'scene'
            ? 'Clear, concise scene heading announcement'
            : 'Subtle, neutral stage direction';

      return { voiceName, persona, emotion };
    },
    [castProfiles]
  );

  const getBlockCacheKey = useCallback(
    (block: ScriptBlock): string => {
      const cfg = getBlockVoiceConfig(block);
      return makeCacheKey(cfg.voiceName, cfg.persona, cfg.emotion, block.text);
    },
    [getBlockVoiceConfig]
  );

  const cachedCount = useMemo(
    () =>
      playableBlocks.filter((b) => Boolean(audioCache[getBlockCacheKey(b)])).length,
    [playableBlocks, audioCache, getBlockCacheKey]
  );

  const estimatedDurationSeconds = useMemo(() => {
    if (playableBlocks.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < playableBlocks.length; i += 1) {
      const block = playableBlocks[i];
      const clip = audioCache[getBlockCacheKey(block)];
      if (clip) {
        total += clip.durationSeconds;
      } else {
        const wordCount = block.text.split(/\s+/).filter(Boolean).length;
        total += Math.max(1.2, wordCount * 0.36);
      }
      if (i < playableBlocks.length - 1) {
        total += pauseGapMs / 1000;
      }
    }
    return total;
  }, [playableBlocks, audioCache, getBlockCacheKey, pauseGapMs]);

  const ensureAudioContext = useCallback((): {
    ctx: AudioContext;
    analyser: AnalyserNode;
  } => {
    if (!audioCtxRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioContextCtor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current! };
  }, []);

  const stopAudioEngine = useCallback((resetActiveBlock: boolean) => {
    playbackSessionRef.current += 1;
    continuousModeRef.current = false;

    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    if (progressRafRef.current !== null) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Already stopped
      }
      activeSourceRef.current = null;
    }

    if (resetActiveBlock) {
      setActiveBlockId(null);
      setLineProgress(0);
      setLineDurationSeconds(0);
      setPlaybackStatus('idle');
    } else {
      setPlaybackStatus('paused');
    }
  }, []);

  const synthesizeLine = useCallback(
    async (block: ScriptBlock, forceRegenerate = false): Promise<AudioClip> => {
      const cfg = getBlockVoiceConfig(block);
      const cacheKey = makeCacheKey(
        cfg.voiceName,
        cfg.persona,
        cfg.emotion,
        block.text
      );

      if (!forceRegenerate && audioCacheRef.current[cacheKey]) {
        return audioCacheRef.current[cacheKey];
      }

      setSynthesizingBlockIds((prev) => new Set(prev).add(block.id));

      try {
        const res = await fetch('/api/tts/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: block.text,
            voiceName: cfg.voiceName,
            persona: cfg.persona,
            emotion: cfg.emotion,
          }),
        });

        const payload = (await res.json()) as {
          audioBase64?: string;
          mimeType?: string;
          error?: string;
        };

        if (!res.ok || !payload.audioBase64) {
          throw new Error(
            payload.error || `Failed to synthesize line ${block.lineNumber}.`
          );
        }

        const decoded = decodeWavBase64ToPcm(payload.audioBase64);
        const clip: AudioClip = {
          cacheKey,
          audioBase64: payload.audioBase64,
          mimeType: payload.mimeType || 'audio/wav',
          durationSeconds: decoded.durationSeconds,
          sampleRate: decoded.sampleRate,
        };

        audioCacheRef.current = {
          ...audioCacheRef.current,
          [cacheKey]: clip,
        };
        setAudioCache((prev) => ({
          ...prev,
          [cacheKey]: clip,
        }));

        return clip;
      } finally {
        setSynthesizingBlockIds((prev) => {
          const next = new Set(prev);
          next.delete(block.id);
          return next;
        });
      }
    },
    [getBlockVoiceConfig]
  );

  const playClipAtBlock = useCallback(
    async (
      targetIndex: number,
      continuous: boolean
    ): Promise<void> => {
      if (targetIndex < 0 || targetIndex >= playableBlocks.length) {
        stopAudioEngine(true);
        return;
      }

      const block = playableBlocks[targetIndex];
      const sessionId = ++playbackSessionRef.current;
      continuousModeRef.current = continuous;

      if (nextTimerRef.current !== null) {
        window.clearTimeout(nextTimerRef.current);
        nextTimerRef.current = null;
      }
      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.onended = null;
          activeSourceRef.current.stop();
          activeSourceRef.current.disconnect();
        } catch {
          // ignore
        }
        activeSourceRef.current = null;
      }

      setErrorMessage(null);
      setActiveBlockId(block.id);
      setLineProgress(0);
      setPlaybackStatus('synthesizing');

      try {
        const { ctx, analyser } = ensureAudioContext();
        const clip = await synthesizeLine(block);

        if (playbackSessionRef.current !== sessionId) return;

        // Background lookahead prefetch of next line
        if (continuous && targetIndex + 1 < playableBlocks.length) {
          const nextBlock = playableBlocks[targetIndex + 1];
          const nextKey = getBlockCacheKey(nextBlock);
          if (!audioCacheRef.current[nextKey]) {
            void synthesizeLine(nextBlock).catch(() => {
              // Lookahead failure will surface if/when line is actually played
            });
          }
        }

        const decoded = decodeWavBase64ToPcm(clip.audioBase64);
        const audioBuffer = ctx.createBuffer(
          decoded.numChannels,
          decoded.pcm.length / decoded.numChannels,
          decoded.sampleRate
        );
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < decoded.pcm.length; i += 1) {
          channelData[i] = decoded.pcm[i] / 32768;
        }

        if (playbackSessionRef.current !== sessionId) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(analyser);
        activeSourceRef.current = source;

        const effectiveDuration = audioBuffer.duration / playbackRate;
        setLineDurationSeconds(effectiveDuration);
        setPlaybackStatus('playing');

        const startTime = ctx.currentTime;

        const tickProgress = () => {
          if (playbackSessionRef.current !== sessionId) return;
          const elapsed = ctx.currentTime - startTime;
          const pct = Math.min(1, Math.max(0, elapsed / Math.max(0.01, effectiveDuration)));
          setLineProgress(pct);
          if (pct < 1) {
            progressRafRef.current = requestAnimationFrame(tickProgress);
          }
        };
        progressRafRef.current = requestAnimationFrame(tickProgress);

        source.onended = () => {
          if (playbackSessionRef.current !== sessionId) return;
          if (progressRafRef.current !== null) {
            cancelAnimationFrame(progressRafRef.current);
            progressRafRef.current = null;
          }
          setLineProgress(1);

          if (continuousModeRef.current && targetIndex + 1 < playableBlocks.length) {
            nextTimerRef.current = window.setTimeout(() => {
              if (playbackSessionRef.current !== sessionId) return;
              void playClipAtBlock(targetIndex + 1, true);
            }, pauseGapMs);
          } else {
            stopAudioEngine(true);
          }
        };

        source.start();
      } catch (err: unknown) {
        if (playbackSessionRef.current !== sessionId) return;
        const msg =
          err instanceof Error ? err.message : 'Unable to play line audio.';
        setErrorMessage(msg);
        stopAudioEngine(true);
      }
    },
    [
      playableBlocks,
      ensureAudioContext,
      synthesizeLine,
      getBlockCacheKey,
      playbackRate,
      pauseGapMs,
      stopAudioEngine,
    ]
  );

  const handlePlayAll = () => {
    if (playableBlocks.length === 0) return;
    if (playbackStatus === 'paused' && activeBlockId) {
      const idx = playableBlocks.findIndex((b) => b.id === activeBlockId);
      void playClipAtBlock(idx >= 0 ? idx : 0, true);
      return;
    }
    void playClipAtBlock(0, true);
  };

  const handlePlayLine = (blockId: string) => {
    if (activeBlockId === blockId && playbackStatus === 'playing') {
      stopAudioEngine(false);
      return;
    }
    const idx = playableBlocks.findIndex((b) => b.id === blockId);
    if (idx >= 0) {
      void playClipAtBlock(idx, true);
    }
  };

  const handleRegenerateLine = async (blockId: string) => {
    const block = playableBlocks.find((b) => b.id === blockId);
    if (!block) return;
    setErrorMessage(null);
    try {
      await synthesizeLine(block, true);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to regenerate line audio.'
      );
    }
  };

  const handlePrevLine = () => {
    const currentIndex = playableBlocks.findIndex((b) => b.id === activeBlockId);
    if (currentIndex > 0) {
      void playClipAtBlock(currentIndex - 1, playbackStatus === 'playing');
    }
  };

  const handleNextLine = () => {
    const currentIndex = playableBlocks.findIndex((b) => b.id === activeBlockId);
    if (currentIndex >= 0 && currentIndex + 1 < playableBlocks.length) {
      void playClipAtBlock(currentIndex + 1, playbackStatus === 'playing');
    }
  };

  const synthesizeAllRemaining = useCallback(async (): Promise<boolean> => {
    const missing = playableBlocks.filter(
      (b) => !audioCacheRef.current[getBlockCacheKey(b)]
    );
    if (missing.length === 0) return true;

    setErrorMessage(null);
    setIsBatchSynthesizing(true);
    setBatchProgress({ completed: 0, total: missing.length });

    try {
      for (let i = 0; i < missing.length; i += 1) {
        await synthesizeLine(missing[i]);
        setBatchProgress({ completed: i + 1, total: missing.length });
      }
      return true;
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Batch synthesis failed.'
      );
      return false;
    } finally {
      setIsBatchSynthesizing(false);
      setBatchProgress(null);
    }
  }, [playableBlocks, getBlockCacheKey, synthesizeLine]);

  const handleAuditionCharacter = async (character: string) => {
    const profile = castProfiles[character];
    if (!profile) return;
    setErrorMessage(null);
    setAuditioningCharacter(character);

    try {
      const sampleLine =
        blocks.find((b) => b.type === 'dialogue' && b.character === character)
          ?.text ||
        `Hello, this is ${character.toLowerCase()} speaking for the table read.`;

      const res = await fetch('/api/tts/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleLine.slice(0, 140),
          voiceName: profile.voiceName,
          persona: profile.persona,
          emotion: 'Warm, expressive',
        }),
      });
      const payload = (await res.json()) as {
        audioBase64?: string;
        error?: string;
      };
      if (!res.ok || !payload.audioBase64) {
        throw new Error(payload.error || 'Voice audition failed.');
      }

      const { ctx, analyser } = ensureAudioContext();
      const decoded = decodeWavBase64ToPcm(payload.audioBase64);
      const buffer = ctx.createBuffer(
        decoded.numChannels,
        decoded.pcm.length / decoded.numChannels,
        decoded.sampleRate
      );
      const ch = buffer.getChannelData(0);
      for (let i = 0; i < decoded.pcm.length; i += 1) {
        ch[i] = decoded.pcm[i] / 32768;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      source.start();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Voice audition failed.'
      );
    } finally {
      setAuditioningCharacter(null);
    }
  };

  const handleAutoTagEmotions = async () => {
    const dialogueLines = blocks.filter((b) => b.type === 'dialogue');
    if (dialogueLines.length === 0) return;

    setErrorMessage(null);
    setIsTaggingEmotions(true);

    try {
      const res = await fetch('/api/script/suggest-emotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scriptTitle,
          lines: dialogueLines.map((b) => ({
            id: b.id,
            type: b.type,
            character: b.character,
            text: b.text,
          })),
        }),
      });
      const payload = (await res.json()) as {
        suggestions?: Array<{ id: string; emotion: string }>;
        error?: string;
      };
      if (!res.ok || !payload.suggestions) {
        throw new Error(payload.error || 'Failed to suggest emotions.');
      }

      const map = new Map(
        payload.suggestions.map((s) => [s.id, s.emotion.trim()])
      );
      setBlocks((prev) =>
        prev.map((block) => {
          const suggested = map.get(block.id);
          return suggested ? { ...block, emotion: suggested } : block;
        })
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to suggest emotions.'
      );
    } finally {
      setIsTaggingEmotions(false);
    }
  };

  const handleApplyScript = (
    rawText: string,
    titleOverride?: string,
    isFdx?: boolean
  ) => {
    stopAudioEngine(true);
    setActiveSampleId(null);

    const parsed = isFdx
      ? parseFdxXml(rawText, titleOverride || 'Imported Screenplay')
      : parseScriptText(rawText, titleOverride || scriptTitle || 'Untitled Script');

    const finalTitle =
      titleOverride && !isFdx && parsed.title === 'Untitled Script'
        ? titleOverride
        : parsed.title;

    setScriptTitle(finalTitle);
    setBlocks(parsed.blocks);
    setCastProfiles((prev) => buildCastProfiles(parsed.blocks, prev));
    if (masterAudioUrl) {
      URL.revokeObjectURL(masterAudioUrl);
      setMasterAudioUrl(null);
      setMasterFileName(null);
    }
  };

  const handleSelectSample = (sampleId: string) => {
    const found = SAMPLE_SCRIPTS.find((s) => s.id === sampleId);
    if (!found) return;
    stopAudioEngine(true);
    setActiveSampleId(found.id);
    const parsed = parseScriptText(found.rawText, found.title);
    setScriptTitle(parsed.title);
    setBlocks(parsed.blocks);
    setCastProfiles(
      buildCastProfiles(parsed.blocks, {}, found.defaultVoices)
    );
    if (masterAudioUrl) {
      URL.revokeObjectURL(masterAudioUrl);
      setMasterAudioUrl(null);
      setMasterFileName(null);
    }
  };

  const handleClearScript = () => {
    stopAudioEngine(true);
    setActiveSampleId(null);
    setScriptTitle('Untitled Script');
    setBlocks([]);
    setCastProfiles({});
    if (masterAudioUrl) {
      URL.revokeObjectURL(masterAudioUrl);
      setMasterAudioUrl(null);
      setMasterFileName(null);
    }
  };

  const handleExportAudio = async () => {
    if (playableBlocks.length === 0) return;
    setErrorMessage(null);
    setIsExporting(true);
    setExportProgress('Synthesizing lines...');

    try {
      const ok = await synthesizeAllRemaining();
      if (!ok) {
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      setExportProgress(`Encoding ${exportFormat.toUpperCase()}...`);

      const segments: Int16Array[] = [];
      let sampleRate = 24000;

      for (const block of playableBlocks) {
        const key = getBlockCacheKey(block);
        const clip = audioCacheRef.current[key];
        if (!clip) {
          throw new Error(`Missing synthesized audio for line ${block.lineNumber}.`);
        }
        const decoded = decodeWavBase64ToPcm(clip.audioBase64);
        sampleRate = decoded.sampleRate;
        segments.push(decoded.pcm);
      }

      const combinedPcm = concatenatePcmSegments(segments, pauseGapMs, sampleRate);
      const outputBytes =
        exportFormat === 'mp3'
          ? encodePcmToMp3(combinedPcm, sampleRate, 192)
          : encodePcmToWav(combinedPcm, sampleRate, 1);

      const mimeType = exportFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const blob = new Blob([new Uint8Array(outputBytes)], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const fileName = `${slugifyFileName(scriptTitle)}-table-read.${exportFormat}`;

      if (masterAudioUrl) {
        URL.revokeObjectURL(masterAudioUrl);
      }
      setMasterAudioUrl(url);
      setMasterFileName(fileName);

      // Trigger automatic browser download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to export audio file.'
      );
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportScriptText = () => {
    const text = formatBlocksToRawScript(blocks, scriptTitle);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugifyFileName(scriptTitle)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectNavSection = (section: WorkspaceSection) => {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeBlock = useMemo(
    () => playableBlocks.find((b) => b.id === activeBlockId) || null,
    [playableBlocks, activeBlockId]
  );
  const activeBlockIndex = useMemo(
    () => playableBlocks.findIndex((b) => b.id === activeBlockId),
    [playableBlocks, activeBlockId]
  );

  const currentRawText = useMemo(
    () => formatBlocksToRawScript(blocks, scriptTitle),
    [blocks, scriptTitle]
  );

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#111318]">
      <TopBar
        activeSection={activeSection}
        onSelectSection={handleSelectNavSection}
        onOpenImport={() => {
          setEditorModalMode('import');
          setEditorModalOpen(true);
        }}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
              className="rounded p-1 text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left 7/12 (or 8/12) Manuscript Column */}
          <div className="lg:col-span-8">
            <ManuscriptView
              title={scriptTitle}
              onChangeTitle={setScriptTitle}
              blocks={blocks}
              castProfiles={castProfiles}
              includeStageDirections={includeStageDirections}
              onToggleStageDirections={setIncludeStageDirections}
              activeBlockId={activeBlockId}
              isPlaying={playbackStatus === 'playing'}
              synthesizingBlockIds={synthesizingBlockIds}
              audioCache={audioCache}
              getBlockCacheKey={getBlockCacheKey}
              onPlayLine={handlePlayLine}
              onRegenerateLine={handleRegenerateLine}
              onUpdateBlockEmotion={(blockId, emotion) =>
                setBlocks((prev) =>
                  prev.map((b) => (b.id === blockId ? { ...b, emotion } : b))
                )
              }
              onUpdateBlockText={(blockId, text) =>
                setBlocks((prev) =>
                  prev.map((b) => (b.id === blockId ? { ...b, text } : b))
                )
              }
              onOpenPasteEditor={() => {
                setEditorModalMode('paste');
                setEditorModalOpen(true);
              }}
              onAutoTagEmotions={handleAutoTagEmotions}
              isTaggingEmotions={isTaggingEmotions}
              samples={SAMPLE_SCRIPTS}
              activeSampleId={activeSampleId}
              onSelectSample={handleSelectSample}
              onClearScript={handleClearScript}
            />
          </div>

          {/* Right 4/12 Studio Rail */}
          <aside className="flex flex-col gap-5 lg:col-span-4 lg:sticky lg:top-20">
            <TransportPanel
              status={playbackStatus}
              playableBlocks={playableBlocks}
              activeBlock={activeBlock}
              activeBlockIndex={activeBlockIndex}
              cachedCount={cachedCount}
              lineProgress={lineProgress}
              lineDurationSeconds={lineDurationSeconds}
              playbackRate={playbackRate}
              onChangePlaybackRate={setPlaybackRate}
              pauseGapMs={pauseGapMs}
              onChangePauseGapMs={setPauseGapMs}
              isBatchSynthesizing={isBatchSynthesizing}
              batchProgress={batchProgress}
              onPlayAll={handlePlayAll}
              onPause={() => stopAudioEngine(false)}
              onStop={() => stopAudioEngine(true)}
              onPrevLine={handlePrevLine}
              onNextLine={handleNextLine}
              onSynthesizeAll={() => {
                void synthesizeAllRemaining();
              }}
              analyserNode={analyserRef.current}
            />

            <CastPanel
              castProfiles={castProfiles}
              includeStageDirections={includeStageDirections}
              auditioningCharacter={auditioningCharacter}
              onChangeVoice={(character, voiceName) =>
                setCastProfiles((prev) => ({
                  ...prev,
                  [character]: {
                    ...prev[character],
                    voiceName,
                  },
                }))
              }
              onChangePersona={(character, persona) =>
                setCastProfiles((prev) => ({
                  ...prev,
                  [character]: {
                    ...prev[character],
                    persona,
                  },
                }))
              }
              onAuditionCharacter={handleAuditionCharacter}
            />

            <ExportPanel
              format={exportFormat}
              onChangeFormat={setExportFormat}
              totalPlayableLines={playableBlocks.length}
              cachedLineCount={cachedCount}
              estimatedDurationSeconds={estimatedDurationSeconds}
              isExporting={isExporting}
              exportProgress={exportProgress}
              masterAudioUrl={masterAudioUrl}
              masterFileName={masterFileName}
              onExportAudio={handleExportAudio}
              onExportScriptText={handleExportScriptText}
            />
          </aside>
        </div>
      </main>

      {editorModalOpen && (
        <ScriptEditorModal
          key={`${editorModalMode}-${blocks.length}-${scriptTitle}`}
          isOpen={editorModalOpen}
          initialMode={editorModalMode}
          currentTitle={scriptTitle}
          currentRawText={currentRawText}
          onClose={() => setEditorModalOpen(false)}
          onApplyScript={handleApplyScript}
        />
      )}
    </div>
  );
}
