import type { VoiceName } from '../types/script';

export interface VoiceOption {
  name: VoiceName;
  label: string;
  characterNote: string;
  pitchHint: string;
}

export const GEMINI_VOICES: VoiceOption[] = [
  {
    name: 'Kore',
    label: 'Kore',
    characterNote: 'Warm, articulate, grounded',
    pitchHint: 'Mid-warm',
  },
  {
    name: 'Charon',
    label: 'Charon',
    characterNote: 'Deep, resonant, authoritative',
    pitchHint: 'Low-baritone',
  },
  {
    name: 'Puck',
    label: 'Puck',
    characterNote: 'Lively, expressive, nimble',
    pitchHint: 'Bright-tenor',
  },
  {
    name: 'Fenrir',
    label: 'Fenrir',
    characterNote: 'Bold, textured, intense',
    pitchHint: 'Low-gravelly',
  },
  {
    name: 'Zephyr',
    label: 'Zephyr',
    characterNote: 'Airy, poised, conversational',
    pitchHint: 'Clear-alto',
  },
];

export const EMOTION_PRESETS: string[] = [
  'Neutral',
  'Warm & reassuring',
  'Whispering, tense',
  'Urgent & breathless',
  'Sarcastic, dry',
  'Amused, light chuckle',
  'Angry, clipped',
  'Heartbroken, trembling',
  'Nervous, hesitant',
  'Deadpan',
  'Authoritative, firm',
  'Suspicious, quiet',
];

export const VOCAL_CUES: Array<{ token: string; label: string }> = [
  { token: '<breath>', label: 'Breath' },
  { token: '<laugh>', label: 'Laugh' },
  { token: '<gasp>', label: 'Gasp' },
  { token: '|mhm|', label: 'Mhm' },
  { token: '|yeah|', label: 'Yeah' },
];

export const NARRATOR_KEY = 'NARRATOR';
