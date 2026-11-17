import { ArrowLeft, Loader2, Volume2 } from 'lucide-react';
import type { CharacterVoiceProfile, ScriptBlock, VoiceName } from '../types/script';
import { GEMINI_VOICES, NARRATOR_KEY } from '../constants/voices';

interface CastPanelProps {
  variant?: 'compact' | 'full';
  castProfiles: Record<string, CharacterVoiceProfile>;
  blocks?: ScriptBlock[];
  includeStageDirections: boolean;
  onToggleStageDirections?: (enabled: boolean) => void;
  auditioningCharacter: string | null;
  onChangeVoice: (character: string, voiceName: VoiceName) => void;
  onChangePersona: (character: string, persona: string) => void;
  onAuditionCharacter: (character: string) => void;
  onBackToManuscript?: () => void;
  onOpenFullCast?: () => void;
}

export function CastPanel({
  variant = 'compact',
  castProfiles,
  blocks = [],
  includeStageDirections,
  onToggleStageDirections,
  auditioningCharacter,
  onChangeVoice,
  onChangePersona,
  onAuditionCharacter,
  onBackToManuscript,
  onOpenFullCast,
}: CastPanelProps) {
  const entries = Object.values(castProfiles).filter((profile) => {
    if (profile.name === NARRATOR_KEY) {
      if (variant === 'full') return profile.lineCount > 0;
      return includeStageDirections && profile.lineCount > 0;
    }
    return profile.lineCount > 0;
  });

  if (variant === 'full') {
    return (
      <section aria-label="Cast and voices studio" className="flex flex-col gap-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
                Cast & Voice Studio
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Assign distinct voices, shape character personas, and audition each role before running your table read.
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

          {onToggleStageDirections && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700 select-none">
                <input
                  type="checkbox"
                  checked={includeStageDirections}
                  onChange={(e) => onToggleStageDirections(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Enable Narrator voice for scene headings & stage directions</span>
              </label>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          {entries.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-display text-base font-semibold text-zinc-900">
                No characters in current script
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Load a sample script or paste your own play to cast voices.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {entries.map((profile) => {
                const isNarrator = profile.name === NARRATOR_KEY;
                const isAuditioning = auditioningCharacter === profile.name;
                const voiceMeta = GEMINI_VOICES.find(
                  (v) => v.name === profile.voiceName
                );
                const sampleLine = blocks.find((b) =>
                  isNarrator
                    ? b.type === 'action' || b.type === 'scene'
                    : b.type === 'dialogue' && b.character === profile.name
                )?.text;

                return (
                  <div key={profile.name} className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <h2 className="font-mono text-base font-semibold tracking-wide text-zinc-950">
                            {isNarrator ? 'NARRATOR (Stage Directions)' : profile.name}
                          </h2>
                          <span className="text-xs text-zinc-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {profile.lineCount}{' '}
                            {profile.lineCount === 1 ? 'line' : 'lines'}
                          </span>
                          {isNarrator && !includeStageDirections && (
                            <>
                              <span className="text-xs text-zinc-400" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-zinc-500">
                                Currently muted
                              </span>
                            </>
                          )}
                        </div>
                        {voiceMeta && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {voiceMeta.pitchHint} · {voiceMeta.characterNote}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onAuditionCharacter(profile.name)}
                        disabled={isAuditioning}
                        aria-label={`Audition voice for ${profile.name}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isAuditioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{isAuditioning ? 'Auditioning...' : 'Audition Voice'}</span>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`full-voice-select-${profile.name}`}
                          className="block text-xs font-medium text-zinc-700"
                        >
                          Base Gemini Voice
                        </label>
                        <select
                          id={`full-voice-select-${profile.name}`}
                          aria-label={`Voice for ${profile.name}`}
                          value={profile.voiceName}
                          onChange={(e) =>
                            onChangeVoice(profile.name, e.target.value as VoiceName)
                          }
                          className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                        >
                          {GEMINI_VOICES.map((voice) => (
                            <option key={voice.name} value={voice.name}>
                              {voice.label} — {voice.pitchHint} ({voice.characterNote})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`full-persona-input-${profile.name}`}
                          className="block text-xs font-medium text-zinc-700"
                        >
                          Character Voice Persona
                        </label>
                        <input
                          id={`full-persona-input-${profile.name}`}
                          type="text"
                          aria-label={`Voice persona for ${profile.name}`}
                          value={profile.persona}
                          onChange={(e) =>
                            onChangePersona(profile.name, e.target.value)
                          }
                          placeholder="e.g., smoky, world-weary detective"
                          className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {sampleLine && (
                      <p className="mt-3 truncate font-mono text-xs text-zinc-500">
                        Sample line: &ldquo;{sampleLine}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      id="cast"
      aria-label="Cast and voices"
      className="rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-zinc-950">
            Cast & Voice Assignment
          </h2>
          <p className="text-[11px] text-zinc-500 tabular-nums">
            {entries.length} {entries.length === 1 ? 'role' : 'roles'}
          </p>
        </div>
        {onOpenFullCast && (
          <button
            type="button"
            onClick={onOpenFullCast}
            className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
          >
            Open Studio
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-zinc-500">
          Characters detected in your script will appear here for voice casting.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {entries.map((profile) => {
            const isAuditioning = auditioningCharacter === profile.name;
            const voiceMeta = GEMINI_VOICES.find(
              (v) => v.name === profile.voiceName
            );

            return (
              <div key={profile.name} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-xs font-semibold tracking-wide text-zinc-950">
                      {profile.name === NARRATOR_KEY
                        ? 'NARRATOR (Stage Directions)'
                        : profile.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                      {profile.lineCount}{' '}
                      {profile.lineCount === 1 ? 'line' : 'lines'}
                      {voiceMeta ? ` · ${voiceMeta.characterNote}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAuditionCharacter(profile.name)}
                    disabled={isAuditioning}
                    aria-label={`Audition voice for ${profile.name}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isAuditioning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden="true" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                    )}
                    <span>{isAuditioning ? 'Testing' : 'Preview'}</span>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5">
                  <div>
                    <label
                      htmlFor={`voice-select-${profile.name}`}
                      className="sr-only"
                    >
                      Voice for {profile.name}
                    </label>
                    <select
                      id={`voice-select-${profile.name}`}
                      aria-label={`Voice for ${profile.name}`}
                      value={profile.voiceName}
                      onChange={(e) =>
                        onChangeVoice(profile.name, e.target.value as VoiceName)
                      }
                      className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      {GEMINI_VOICES.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.label} — {voice.pitchHint} ({voice.characterNote})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`persona-input-${profile.name}`}
                      className="sr-only"
                    >
                      Voice persona for {profile.name}
                    </label>
                    <input
                      id={`persona-input-${profile.name}`}
                      type="text"
                      aria-label={`Voice persona for ${profile.name}`}
                      value={profile.persona}
                      onChange={(e) =>
                        onChangePersona(profile.name, e.target.value)
                      }
                      placeholder="Voice persona (e.g., smoky, world-weary detective)"
                      className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
