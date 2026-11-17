import { ArrowLeft, CheckCircle2, Clock, Download, FileAudio, FileText, Loader2 } from 'lucide-react';
import type { AudioClip, ExportFormat, ScriptBlock } from '../types/script';
import { formatTimecode } from '../utils/audioConcat';

interface ExportPanelProps {
  variant?: 'compact' | 'full';
  scriptTitle?: string;
  playableBlocks?: ScriptBlock[];
  audioCache?: Record<string, AudioClip>;
  getBlockCacheKey?: (block: ScriptBlock) => string;
  pauseGapMs?: number;
  format: ExportFormat;
  onChangeFormat: (format: ExportFormat) => void;
  totalPlayableLines: number;
  cachedLineCount: number;
  estimatedDurationSeconds: number;
  isExporting: boolean;
  exportProgress: string | null;
  masterAudioUrl: string | null;
  masterFileName: string | null;
  onExportAudio: () => void;
  onExportScriptText: () => void;
  onBackToManuscript?: () => void;
  onOpenFullExport?: () => void;
}

export function ExportPanel({
  variant = 'compact',
  scriptTitle = 'Table Read',
  playableBlocks = [],
  audioCache = {},
  getBlockCacheKey,
  pauseGapMs = 400,
  format,
  onChangeFormat,
  totalPlayableLines,
  cachedLineCount,
  estimatedDurationSeconds,
  isExporting,
  exportProgress,
  masterAudioUrl,
  masterFileName,
  onExportAudio,
  onExportScriptText,
  onBackToManuscript,
  onOpenFullExport,
}: ExportPanelProps) {
  if (variant === 'full') {
    return (
      <section aria-label="Export finished audio studio" className="flex flex-col gap-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
                Export Table Read Audio
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Synthesize any pending lines for &ldquo;{scriptTitle}&rdquo; and stitch all clips with {(pauseGapMs / 1000).toFixed(1)}s beat pauses into a shareable MP3 or WAV file.
              </p>
            </div>

            {onBackToManuscript && (
              <button
                type="button"
                onClick={onBackToManuscript}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                <span>Back to Manuscript</span>
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-500 tabular-nums">
            <span>{cachedLineCount}/{totalPlayableLines} lines synthesized</span>
            <span aria-hidden="true">·</span>
            <span>Estimated runtime: {formatTimecode(estimatedDurationSeconds)}</span>
            <span aria-hidden="true">·</span>
            <span>24kHz mono master</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 md:col-span-5">
            <h2 className="font-display text-base font-semibold text-zinc-950">
              Output Format & Export
            </h2>

            <div className="mt-4">
              <span className="block text-xs font-medium text-zinc-700">
                Audio Format
              </span>
              <div
                role="group"
                aria-label="Export audio format"
                className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1"
              >
                <button
                  type="button"
                  onClick={() => onChangeFormat('mp3')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    format === 'mp3'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  MP3 (192 kbps)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFormat('wav')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    format === 'wav'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  WAV (Lossless)
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onExportAudio}
                disabled={totalPlayableLines === 0 || isExporting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>{exportProgress || 'Preparing audio...'}</span>
                  </>
                ) : (
                  <>
                    <FileAudio className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {cachedLineCount < totalPlayableLines
                        ? `Synthesize & Export ${format.toUpperCase()}`
                        : `Export Full ${format.toUpperCase()}`}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onExportScriptText}
                disabled={totalPlayableLines === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                <span>Download Annotated Script (.txt)</span>
              </button>
            </div>

            {masterAudioUrl && masterFileName && (
              <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-zinc-900">
                    {masterFileName}
                  </span>
                  <a
                    href={masterAudioUrl}
                    download={masterFileName}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </a>
                </div>
                <audio controls src={masterAudioUrl} className="mt-2.5 h-9 w-full" />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white md:col-span-7">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="font-display text-sm font-semibold text-zinc-950">
                Line Synthesis Checklist
              </h2>
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {playableBlocks.length} {playableBlocks.length === 1 ? 'track' : 'tracks'}
              </span>
            </div>

            {playableBlocks.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-zinc-500">
                No playable lines in the current script.
              </div>
            ) : (
              <div className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto">
                {playableBlocks.map((block) => {
                  const clip = getBlockCacheKey
                    ? audioCache[getBlockCacheKey(block)]
                    : undefined;
                  return (
                    <div
                      key={block.id}
                      className="flex items-center justify-between gap-4 px-5 py-3 text-xs"
                    >
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span className="w-6 shrink-0 font-mono text-zinc-400 tabular-nums">
                          {String(block.lineNumber).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-zinc-900">
                            {block.type === 'dialogue'
                              ? block.character
                              : block.type === 'scene'
                                ? 'SCENE'
                                : 'STAGE'}
                          </span>
                          <p className="truncate text-zinc-500">{block.text}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                        {clip ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            <span className="text-emerald-700">
                              {clip.durationSeconds.toFixed(1)}s
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                            <span className="text-zinc-500">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="export"
      aria-label="Export finished audio"
      className="rounded-xl border border-zinc-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-zinc-950">
          Export Table Read
        </h2>
        {onOpenFullExport ? (
          <button
            type="button"
            onClick={onOpenFullExport}
            className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
          >
            Export Studio
          </button>
        ) : (
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            {estimatedDurationSeconds > 0
              ? `~${formatTimecode(estimatedDurationSeconds)}`
              : '24kHz mono'}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-zinc-500">
        Stitches all spoken lines and beat pauses into a single shareable audio file.
      </p>

      {/* Format Segmented Control */}
      <div className="mt-4">
        <span className="block text-[11px] font-medium text-zinc-500">
          Audio Format
        </span>
        <div
          role="group"
          aria-label="Export audio format"
          className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1"
        >
          <button
            type="button"
            onClick={() => onChangeFormat('mp3')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              format === 'mp3'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            MP3 (192 kbps)
          </button>
          <button
            type="button"
            onClick={() => onChangeFormat('wav')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              format === 'wav'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            WAV (Lossless)
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onExportAudio}
          disabled={totalPlayableLines === 0 || isExporting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{exportProgress || 'Preparing audio...'}</span>
            </>
          ) : (
            <>
              <FileAudio className="h-4 w-4" aria-hidden="true" />
              <span>
                {cachedLineCount < totalPlayableLines
                  ? `Synthesize & Export ${format.toUpperCase()}`
                  : `Export Full ${format.toUpperCase()}`}
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onExportScriptText}
          disabled={totalPlayableLines === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap"
        >
          <FileText className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <span>Download Annotated Script (.txt)</span>
        </button>
      </div>

      {masterAudioUrl && masterFileName && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-zinc-800">
              {masterFileName}
            </span>
            <a
              href={masterAudioUrl}
              download={masterFileName}
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download</span>
            </a>
          </div>
          <audio
            controls
            src={masterAudioUrl}
            className="mt-2.5 h-9 w-full"
          />
        </div>
      )}
    </section>
  );
}
