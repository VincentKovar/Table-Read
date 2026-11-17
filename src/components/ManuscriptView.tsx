import { useEffect, useRef, useState } from 'react';
import {
  Check,
  FileEdit,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type {
  AudioClip,
  CharacterVoiceProfile,
  SampleScriptItem,
  ScriptBlock,
} from '../types/script';
import { EMOTION_PRESETS, NARRATOR_KEY, VOCAL_CUES } from '../constants/voices';
import { formatTimecode } from '../utils/audioConcat';

interface ManuscriptViewProps {
  title: string;
  onChangeTitle: (title: string) => void;
  blocks: ScriptBlock[];
  castProfiles: Record<string, CharacterVoiceProfile>;
  includeStageDirections: boolean;
  onToggleStageDirections: (enabled: boolean) => void;
  activeBlockId: string | null;
  isPlaying: boolean;
  synthesizingBlockIds: Set<string>;
  audioCache: Record<string, AudioClip>;
  getBlockCacheKey: (block: ScriptBlock) => string;
  onPlayLine: (blockId: string) => void;
  onRegenerateLine: (blockId: string) => void;
  onUpdateBlockEmotion: (blockId: string, emotion: string) => void;
  onUpdateBlockText: (blockId: string, text: string) => void;
  onOpenPasteEditor: () => void;
  onAutoTagEmotions: () => void;
  isTaggingEmotions: boolean;
  samples: SampleScriptItem[];
  activeSampleId: string | null;
  onSelectSample: (sampleId: string) => void;
  onClearScript: () => void;
}

export function ManuscriptView({
  title,
  onChangeTitle,
  blocks,
  castProfiles,
  includeStageDirections,
  onToggleStageDirections,
  activeBlockId,
  isPlaying,
  synthesizingBlockIds,
  audioCache,
  getBlockCacheKey,
  onPlayLine,
  onRegenerateLine,
  onUpdateBlockEmotion,
  onUpdateBlockText,
  onOpenPasteEditor,
  onAutoTagEmotions,
  isTaggingEmotions,
  samples,
  activeSampleId,
  onSelectSample,
  onClearScript,
}: ManuscriptViewProps) {
  const [editingEmotionBlockId, setEditingEmotionBlockId] = useState<string | null>(null);
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const lineRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (activeBlockId && lineRefs.current[activeBlockId]) {
      lineRefs.current[activeBlockId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeBlockId]);

  const dialogueCount = blocks.filter((b) => b.type === 'dialogue').length;
  const characterCount = Object.keys(castProfiles).filter(
    (k) => k !== NARRATOR_KEY
  ).length;
  const sceneCount = blocks.filter((b) => b.type === 'scene').length;

  return (
    <section id="manuscript" aria-label="Script manuscript" className="flex flex-col gap-5">
      {/* Sample Selector & Workspace Toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="script-title-input" className="sr-only">
              Script title
            </label>
            <input
              id="script-title-input"
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Untitled Script"
              className="w-full max-w-xl bg-transparent font-display text-2xl font-bold tracking-tight text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-600/20 rounded-md px-1 -ml-1"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 tabular-nums">
              <span>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</span>
              <span aria-hidden="true">·</span>
              <span>{dialogueCount} {dialogueCount === 1 ? 'dialogue line' : 'dialogue lines'}</span>
              <span aria-hidden="true">·</span>
              <span>{sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenPasteEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              <FileEdit className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              <span>Paste / Edit Script</span>
            </button>

            <button
              type="button"
              onClick={onAutoTagEmotions}
              disabled={isTaggingEmotions || dialogueCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isTaggingEmotions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden="true" />
              ) : (
                <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              )}
              <span>{isTaggingEmotions ? 'Directing Emotions...' : 'Auto-Tag Emotions'}</span>
            </button>

            {blocks.length > 0 && (
              <button
                type="button"
                onClick={onClearScript}
                aria-label="Clear current script"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Sample Scripts + Narrator Toggle Row */}
        <div
          id="samples"
          className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 mr-1">
              Sample scripts:
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1">
              {samples.map((sample) => {
                const isSelected = activeSampleId === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onSelectSample(sample.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {sample.title}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={includeStageDirections}
              onChange={(e) => onToggleStageDirections(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Narrate scene headings & stage directions</span>
          </label>
        </div>
      </div>

      {/* Manuscript Body */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-display text-base font-semibold text-zinc-900">
              No script loaded yet
            </p>
            <p className="mt-1.5 max-w-md text-sm text-zinc-500">
              Paste a play or screenplay, import a .txt, .fountain, or .fdx file, or choose a sample script above to begin your table read.
            </p>
            <button
              type="button"
              onClick={onOpenPasteEditor}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FileEdit className="h-4 w-4" aria-hidden="true" />
              <span>Paste or Import Script</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {blocks.map((block) => {
              const isActive = activeBlockId === block.id;
              const isSynthesizing = synthesizingBlockIds.has(block.id);
              const cacheKey = getBlockCacheKey(block);
              const cachedClip = audioCache[cacheKey];
              const isPlayable =
                block.type === 'dialogue' || includeStageDirections;
              const speakerKey =
                block.type === 'dialogue'
                  ? block.character || 'SPEAKER'
                  : NARRATOR_KEY;
              const assignedVoice = castProfiles[speakerKey]?.voiceName || 'Kore';

              if (block.type === 'scene') {
                return (
                  <div
                    key={block.id}
                    ref={(el) => {
                      lineRefs.current[block.id] = el;
                    }}
                    data-block-id={block.id}
                    data-active={isActive ? 'true' : 'false'}
                    className={`group flex items-center justify-between gap-4 px-6 py-3.5 transition-colors ${
                      isActive
                        ? 'bg-blue-50/75 ring-1 ring-inset ring-blue-600/25'
                        : 'bg-zinc-50/60 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-baseline gap-4">
                      <span className="w-6 shrink-0 font-mono text-xs text-zinc-400 tabular-nums">
                        {String(block.lineNumber).padStart(2, '0')}
                      </span>
                      <p className="font-mono text-xs font-semibold tracking-wide text-zinc-700 uppercase">
                        {block.text}
                      </p>
                    </div>

                    {includeStageDirections && (
                      <div className="flex items-center gap-2 shrink-0">
                        {cachedClip && (
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {formatTimecode(cachedClip.durationSeconds)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onPlayLine(block.id)}
                          aria-label={`Play scene heading ${block.lineNumber}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                        >
                          {isSynthesizing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          ) : isActive && isPlaying ? (
                            <Pause className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (block.type === 'action') {
                return (
                  <div
                    key={block.id}
                    ref={(el) => {
                      lineRefs.current[block.id] = el;
                    }}
                    data-block-id={block.id}
                    data-active={isActive ? 'true' : 'false'}
                    className={`group flex items-start justify-between gap-4 px-6 py-4 transition-colors ${
                      isActive
                        ? 'bg-blue-50/75 ring-1 ring-inset ring-blue-600/25'
                        : 'hover:bg-zinc-50/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-baseline gap-4">
                      <span className="w-6 shrink-0 font-mono text-xs text-zinc-400 tabular-nums">
                        {String(block.lineNumber).padStart(2, '0')}
                      </span>
                      <p className="font-mono text-[13px] italic leading-relaxed text-zinc-600">
                        {block.text}
                      </p>
                    </div>

                    {includeStageDirections && (
                      <div className="flex items-center gap-2 shrink-0">
                        {cachedClip && (
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {formatTimecode(cachedClip.durationSeconds)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onPlayLine(block.id)}
                          aria-label={`Play stage direction ${block.lineNumber}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                        >
                          {isSynthesizing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          ) : isActive && isPlaying ? (
                            <Pause className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // Dialogue block
              const isEditingEmotion = editingEmotionBlockId === block.id;
              const isEditingText = editingTextBlockId === block.id;

              return (
                <article
                  key={block.id}
                  ref={(el) => {
                    lineRefs.current[block.id] = el;
                  }}
                  data-block-id={block.id}
                  data-active={isActive ? 'true' : 'false'}
                  className={`px-6 py-5 transition-colors ${
                    isActive
                      ? 'bg-blue-50/75 ring-1 ring-inset ring-blue-600/25'
                      : 'hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-zinc-400 tabular-nums">
                      {String(block.lineNumber).padStart(2, '0')}
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Character Cue + Metadata + Play Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-sm font-semibold tracking-wide text-zinc-950">
                            {block.character}
                            {block.qualifier ? ` (${block.qualifier})` : ''}
                          </span>
                          <span className="text-xs text-zinc-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-zinc-500">
                            Voice: {assignedVoice}
                          </span>
                          {cachedClip && (
                            <>
                              <span className="text-xs text-zinc-400" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-xs text-emerald-700 tabular-nums">
                                Ready ({cachedClip.durationSeconds.toFixed(1)}s)
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cachedClip && (
                            <button
                              type="button"
                              onClick={() => onRegenerateLine(block.id)}
                              disabled={isSynthesizing}
                              aria-label={`Regenerate audio for line ${block.lineNumber} by ${block.character}`}
                              title="Regenerate line audio"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isPlayable && (
                            <button
                              type="button"
                              onClick={() => onPlayLine(block.id)}
                              disabled={isSynthesizing}
                              aria-label={
                                isActive && isPlaying
                                  ? `Pause line ${block.lineNumber} by ${block.character}`
                                  : `Play line ${block.lineNumber} by ${block.character}`
                              }
                              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                                isActive && isPlaying
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100'
                              }`}
                            >
                              {isSynthesizing ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  <span>Generating</span>
                                </>
                              ) : isActive && isPlaying ? (
                                <>
                                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Play</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Emotion / Delivery Selector */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`emotion-select-${block.id}`}
                          className="text-xs font-medium text-zinc-500"
                        >
                          Emotion:
                        </label>
                        <select
                          id={`emotion-select-${block.id}`}
                          aria-label={`Emotion preset for line ${block.lineNumber}`}
                          value={
                            EMOTION_PRESETS.includes(block.emotion)
                              ? block.emotion
                              : '__custom__'
                          }
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setEditingEmotionBlockId(block.id);
                            } else {
                              onUpdateBlockEmotion(block.id, e.target.value);
                              setEditingEmotionBlockId(null);
                            }
                          }}
                          className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 focus:border-blue-600 focus:bg-white focus:outline-none"
                        >
                          {EMOTION_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                          <option value="__custom__">
                            {EMOTION_PRESETS.includes(block.emotion)
                              ? 'Custom direction...'
                              : `Custom: ${block.emotion}`}
                          </option>
                        </select>

                        {isEditingEmotion || !EMOTION_PRESETS.includes(block.emotion) ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              aria-label={`Custom emotion direction for line ${block.lineNumber}`}
                              value={block.emotion}
                              onChange={(e) =>
                                onUpdateBlockEmotion(block.id, e.target.value)
                              }
                              placeholder="e.g., bitter, barely holding back tears"
                              className="w-56 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                            />
                            {isEditingEmotion && (
                              <button
                                type="button"
                                onClick={() => setEditingEmotionBlockId(null)}
                                aria-label={`Save emotion for line ${block.lineNumber}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingEmotionBlockId(block.id)}
                            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                          >
                            Customize
                          </button>
                        )}
                      </div>

                      {/* Dialogue Text (Click to edit or insert vocal cues) */}
                      {isEditingText ? (
                        <div className="mt-2.5 space-y-2">
                          <textarea
                            aria-label={`Edit dialogue text for line ${block.lineNumber}`}
                            value={block.text}
                            onChange={(e) =>
                              onUpdateBlockText(block.id, e.target.value)
                            }
                            rows={2}
                            className="w-full rounded-lg border border-blue-600/40 bg-white p-2.5 font-mono text-[14px] leading-relaxed text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-zinc-500">
                                Insert vocal cue:
                              </span>
                              {VOCAL_CUES.map((cue) => (
                                <button
                                  key={cue.token}
                                  type="button"
                                  onClick={() =>
                                    onUpdateBlockText(
                                      block.id,
                                      `${block.text.trimEnd()} ${cue.token}`
                                    )
                                  }
                                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-700 hover:bg-zinc-100"
                                >
                                  {cue.token}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingTextBlockId(null)}
                              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <p className="font-mono text-[14px] leading-relaxed text-zinc-900">
                            {block.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditingTextBlockId(block.id)}
                            className="mt-0.5 shrink-0 text-xs text-zinc-400 hover:text-zinc-800"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
