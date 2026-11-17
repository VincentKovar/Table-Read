import { useEffect, useRef } from 'react';
import {
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import type { PlaybackStatus, ScriptBlock } from '../types/script';
import { formatTimecode } from '../utils/audioConcat';

interface TransportPanelProps {
  status: PlaybackStatus;
  playableBlocks: ScriptBlock[];
  activeBlock: ScriptBlock | null;
  activeBlockIndex: number;
  cachedCount: number;
  lineProgress: number; // 0..1
  lineDurationSeconds: number;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  pauseGapMs: number;
  onChangePauseGapMs: (ms: number) => void;
  isBatchSynthesizing: boolean;
  batchProgress: { completed: number; total: number } | null;
  onPlayAll: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrevLine: () => void;
  onNextLine: () => void;
  onSynthesizeAll: () => void;
  analyserNode: AnalyserNode | null;
}

const SPEED_OPTIONS = [0.85, 1, 1.15, 1.25];
const GAP_OPTIONS = [
  { label: 'Tight (0.2s)', value: 200 },
  { label: 'Natural (0.4s)', value: 400 },
  { label: 'Dramatic (0.7s)', value: 700 },
];

export function TransportPanel({
  status,
  playableBlocks,
  activeBlock,
  activeBlockIndex,
  cachedCount,
  lineProgress,
  lineDurationSeconds,
  playbackRate,
  onChangePlaybackRate,
  pauseGapMs,
  onChangePauseGapMs,
  isBatchSynthesizing,
  batchProgress,
  onPlayAll,
  onPause,
  onStop,
  onPrevLine,
  onNextLine,
  onSynthesizeAll,
  analyserNode,
}: TransportPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalCount = playableBlocks.length;
  const isPlaying = status === 'playing';
  const isSynthesizing = status === 'synthesizing' || isBatchSynthesizing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const barCount = 36;
    const dataArray = analyserNode
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : null;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (analyserNode && dataArray && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);
      }

      const barWidth = Math.max(2, (width - (barCount - 1) * 3) / barCount);
      const step = dataArray
        ? Math.max(1, Math.floor(dataArray.length / barCount))
        : 1;

      for (let i = 0; i < barCount; i += 1) {
        let level = 0.08;
        if (isPlaying && dataArray) {
          const val = dataArray[i * step] || 0;
          level = Math.max(0.1, val / 255);
        }
        const barHeight = Math.max(4, level * (height - 8));
        const x = i * (barWidth + 3);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isPlaying ? '#2563EB' : '#D4D4D8';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      }

      if (isPlaying) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [analyserNode, isPlaying]);

  const currentLineElapsed = lineProgress * lineDurationSeconds;

  return (
    <section
      aria-label="Playback transport"
      className="rounded-xl border border-zinc-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-zinc-950">
          Table Read Playback
        </h2>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">
          {cachedCount}/{totalCount} lines ready
        </span>
      </div>

      {/* Active Speaker & Live Waveform */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
            <span className="truncate font-medium text-zinc-900">
              {activeBlock
                ? activeBlock.type === 'dialogue'
                  ? `${activeBlock.character} (${activeBlock.emotion})`
                  : activeBlock.type === 'scene'
                    ? 'Scene Heading'
                    : 'Stage Direction'
                : totalCount > 0
                  ? 'Ready to read'
                  : 'No playable lines'}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-zinc-500 tabular-nums">
            {activeBlockIndex >= 0
              ? `${activeBlockIndex + 1}/${totalCount}`
              : `0/${totalCount}`}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={360}
          height={44}
          data-testid="waveform-canvas"
          aria-label="Audio level visualizer"
          className="mt-2.5 h-11 w-full"
        />

        {/* Line Progress Bar */}
        <div className="mt-2 flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {formatTimecode(currentLineElapsed)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-blue-600 transition-transform duration-100 origin-left"
              style={{
                transform: `scaleX(${Math.min(1, Math.max(0, lineProgress))})`,
              }}
            />
          </div>
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {formatTimecode(lineDurationSeconds)}
          </span>
        </div>
      </div>

      {/* Primary Transport Controls */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevLine}
            disabled={totalCount === 0 || activeBlockIndex <= 0}
            aria-label="Previous line"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={isPlaying ? onPause : onPlayAll}
            disabled={totalCount === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {status === 'synthesizing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Synthesizing...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>{status === 'paused' ? 'Resume' : 'Play Read'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNextLine}
            disabled={
              totalCount === 0 ||
              activeBlockIndex < 0 ||
              activeBlockIndex >= totalCount - 1
            }
            aria-label="Next line"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={status === 'idle'}
            aria-label="Stop playback"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Batch Pre-Synthesize Action */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onSynthesizeAll}
          disabled={totalCount === 0 || isSynthesizing || cachedCount === totalCount}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50"
        >
          {isBatchSynthesizing && batchProgress
            ? `Generating audio (${batchProgress.completed}/${batchProgress.total})...`
            : cachedCount === totalCount && totalCount > 0
              ? 'All lines synthesized & cached'
              : `Generate All Remaining Audio (${totalCount - cachedCount} ${totalCount - cachedCount === 1 ? 'line' : 'lines'})`}
        </button>
      </div>

      {/* Speed & Inter-Line Beat Controls */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
        <div>
          <label
            htmlFor="playback-speed-select"
            className="block text-[11px] font-medium text-zinc-500"
          >
            Playback Speed
          </label>
          <select
            id="playback-speed-select"
            value={playbackRate}
            onChange={(e) => onChangePlaybackRate(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-800 focus:border-blue-600 focus:outline-none"
          >
            {SPEED_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate.toFixed(2).replace(/\.00$/, '.0')}x
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="beat-gap-select"
            className="block text-[11px] font-medium text-zinc-500"
          >
            Beat Pause
          </label>
          <select
            id="beat-gap-select"
            value={pauseGapMs}
            onChange={(e) => onChangePauseGapMs(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-blue-600 focus:outline-none"
          >
            {GAP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
