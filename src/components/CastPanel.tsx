import { Loader2, Volume2 } from 'lucide-react';
import type { CharacterVoiceProfile, VoiceName } from '../types/script';
import { GEMINI_VOICES, NARRATOR_KEY } from '../constants/voices';

interface CastPanelProps {
  castProfiles: Record<string, CharacterVoiceProfile>;
  includeStageDirections: boolean;
  auditioningCharacter: string | null;
  onChangeVoice: (character: string, voiceName: VoiceName) => void;
  onChangePersona: (character: string, persona: string) => void;
  onAuditionCharacter: (character: string) => void;
}

export function CastPanel({
  castProfiles,
  includeStageDirections,
  auditioningCharacter,
  onChangeVoice,
  onChangePersona,
  onAuditionCharacter,
}: CastPanelProps) {
  const entries = Object.values(castProfiles).filter((profile) => {
    if (profile.name === NARRATOR_KEY) {
      return includeStageDirections && profile.lineCount > 0;
    }
    return profile.lineCount > 0;
  });

  return (
    <section
      id="cast"
      aria-label="Cast and voices"
      className="rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <h2 className="font-display text-sm font-semibold text-zinc-950">
          Cast & Voice Assignment
        </h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          {entries.length} {entries.length === 1 ? 'role' : 'roles'}
        </span>
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
