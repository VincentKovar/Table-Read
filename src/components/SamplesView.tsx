import { ArrowRight, Check, FileEdit } from 'lucide-react';
import type { SampleScriptItem } from '../types/script';
import { parseScriptText } from '../utils/scriptParser';

interface SamplesViewProps {
  samples: SampleScriptItem[];
  activeSampleId: string | null;
  onLoadSample: (sampleId: string) => void;
  onOpenPasteEditor: () => void;
}

export function SamplesView({
  samples,
  activeSampleId,
  onLoadSample,
  onOpenPasteEditor,
}: SamplesViewProps) {
  return (
    <section aria-label="Sample scripts library" className="flex flex-col gap-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
              Sample Scripts Library
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Preview ready-to-play scenes with pre-cast character voices and emotional cues, or load one into the Manuscript studio.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPasteEditor}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
          >
            <FileEdit className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            <span>Paste Your Own Script</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {samples.map((sample) => {
          const parsed = parseScriptText(sample.rawText, sample.title);
          const dialogueLines = parsed.blocks.filter((b) => b.type === 'dialogue');
          const isCurrent = activeSampleId === sample.id;
          const excerptBlocks = parsed.blocks.slice(0, 4);

          return (
            <article
              key={sample.id}
              className={`rounded-xl border bg-white p-6 transition-colors ${
                isCurrent ? 'border-blue-600/40 ring-1 ring-blue-600/15' : 'border-zinc-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h2 className="font-display text-lg font-semibold text-zinc-950">
                      {sample.title}
                    </h2>
                    <span className="text-xs font-medium text-zinc-500">
                      {sample.genre}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 tabular-nums">
                    <span>Cast: {parsed.characters.join(', ')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dialogueLines.length} dialogue lines</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLoadSample(sample.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Open in Manuscript</span>
                    </>
                  ) : (
                    <>
                      <span>Load Script</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/70 p-4 font-mono text-xs leading-relaxed text-zinc-700">
                {excerptBlocks.map((blk) => (
                  <div key={blk.id} className="mb-2 last:mb-0">
                    {blk.type === 'scene' && (
                      <p className="font-semibold text-zinc-900 uppercase">
                        {blk.text}
                      </p>
                    )}
                    {blk.type === 'action' && (
                      <p className="italic text-zinc-500">{blk.text}</p>
                    )}
                    {blk.type === 'dialogue' && (
                      <p>
                        <span className="font-semibold text-zinc-950">
                          {blk.character}
                        </span>
                        {blk.emotion && blk.emotion !== 'Neutral' && (
                          <span className="text-zinc-500"> ({blk.emotion})</span>
                        )}
                        : {blk.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
