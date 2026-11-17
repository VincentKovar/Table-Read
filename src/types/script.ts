export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type BlockType = 'scene' | 'action' | 'dialogue';

export interface ScriptBlock {
  id: string;
  type: BlockType;
  character?: string;
  qualifier?: string; // e.g. V.O., O.S., CONT'D
  emotion: string;
  text: string;
  lineNumber: number;
}

export interface CharacterVoiceProfile {
  name: string;
  voiceName: VoiceName;
  persona: string;
  lineCount: number;
}

export interface ParsedScript {
  title: string;
  blocks: ScriptBlock[];
  characters: string[];
}

export interface AudioClip {
  cacheKey: string;
  audioBase64: string;
  mimeType: string;
  durationSeconds: number;
  sampleRate: number;
}

export type PlaybackStatus = 'idle' | 'synthesizing' | 'playing' | 'paused';

export type ExportFormat = 'mp3' | 'wav';

export interface SampleScriptItem {
  id: string;
  title: string;
  genre: string;
  rawText: string;
  defaultVoices: Record<string, { voiceName: VoiceName; persona: string }>;
}
