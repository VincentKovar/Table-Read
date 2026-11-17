import { Download, FileAudio, FileText, Loader2 } from 'lucide-react';
import type { ExportFormat } from '../types/script';
import { formatTimecode } from '../utils/audioConcat';

interface ExportPanelProps {
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
}

export function ExportPanel({
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
}: ExportPanelProps) {
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
        <span className="font-mono text-xs text-zinc-500 tabular-nums">
          {estimatedDurationSeconds > 0
            ? `~${formatTimecode(estimatedDurationSeconds)}`
            : '24kHz mono'}
        </span>
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
