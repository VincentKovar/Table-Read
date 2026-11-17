import type {
  CharacterVoiceProfile,
  ParsedScript,
  ScriptBlock,
  VoiceName,
} from '../types/script';
import { GEMINI_VOICES, NARRATOR_KEY } from '../constants/voices';

const SCENE_HEADING_RE =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|EST\.|ACT\s+[IVX0-9]+|SCENE\s+[IVX0-9]+|PROLOGUE|EPILOGUE|FADE IN:|CUT TO:|DISSOLVE TO:)/i;

const COLON_DIALOGUE_RE =
  /^([A-Z][A-Za-z0-9 .'-]{0,36}?)(?:\s*\(([^)]+)\)|\s*\[([^\]]+)\])?\s*:\s+(.+)$/;

const CHARACTER_CUE_RE =
  /^([A-Z][A-Z0-9 .'-]{0,36}?)(?:\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONTD|PRE-LAP|FILTERED)\))?$/;

const PARENTHETICAL_RE = /^\(([^)]+)\)$|^\[([^\]]+)\]$/;

const VOICE_CYCLE: VoiceName[] = GEMINI_VOICES.map((v) => v.name);

function cleanTitleCaseName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ').toUpperCase();
}

function isLikelyCharacterCue(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 44) return false;
  if (SCENE_HEADING_RE.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed) && !/\((V\.O\.|O\.S\.|O\.C\.|CONT'D)\)$/i.test(trimmed)) {
    return false;
  }
  const match = trimmed.match(CHARACTER_CUE_RE);
  if (!match) return false;
  if (!nextLine || !nextLine.trim()) return false;
  return true;
}

export function extractInlineEmotion(text: string): {
  emotion: string;
  cleanText: string;
} {
  const trimmed = text.trim();
  const leadingMatch = trimmed.match(/^(?:\(([^)]+)\)|\[([^\]]+)\])\s+(.+)$/);
  if (leadingMatch) {
    const emotion = (leadingMatch[1] || leadingMatch[2] || '').trim();
    const cleanText = leadingMatch[3].trim();
    return { emotion, cleanText };
  }
  return { emotion: 'Neutral', cleanText: trimmed };
}

export function parseScriptText(
  rawText: string,
  fallbackTitle = 'Untitled Script'
): ParsedScript {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let title = fallbackTitle;
  const blocks: ScriptBlock[] = [];
  const characterSet = new Set<string>();

  let index = 0;

  // Check for Fountain Title: metadata header
  while (index < lines.length && /^[A-Za-z ]+:\s*.+$/.test(lines[index].trim())) {
    const metaLine = lines[index].trim();
    const colonIdx = metaLine.indexOf(':');
    const key = metaLine.slice(0, colonIdx).trim().toLowerCase();
    const val = metaLine.slice(colonIdx + 1).trim();
    if (key === 'title' && val) {
      title = val;
      index += 1;
      continue;
    }
    if (key === 'credit' || key === 'author' || key === 'draft date' || key === 'source') {
      index += 1;
      continue;
    }
    break;
  }

  let lineCounter = 1;

  const pushBlock = (
    type: ScriptBlock['type'],
    text: string,
    opts?: { character?: string; qualifier?: string; emotion?: string }
  ) => {
    const clean = text.trim();
    if (!clean) return;
    const block: ScriptBlock = {
      id: `blk-${lineCounter}`,
      type,
      text: clean,
      emotion: opts?.emotion?.trim() || 'Neutral',
      lineNumber: lineCounter,
      ...(opts?.character ? { character: opts.character } : {}),
      ...(opts?.qualifier ? { qualifier: opts.qualifier } : {}),
    };
    blocks.push(block);
    lineCounter += 1;
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // 1. Scene headings
    if (SCENE_HEADING_RE.test(trimmed)) {
      pushBlock('scene', trimmed);
      index += 1;
      continue;
    }

    // 2. Colon-style stage play dialogue: "MARA (whispering): You knew."
    const colonMatch = trimmed.match(COLON_DIALOGUE_RE);
    if (colonMatch) {
      const charName = cleanTitleCaseName(colonMatch[1]);
      const inlineEmotion = (colonMatch[2] || colonMatch[3] || '').trim();
      const rawDialogue = colonMatch[4].trim();
      const extracted = inlineEmotion
        ? { emotion: inlineEmotion, cleanText: rawDialogue }
        : extractInlineEmotion(rawDialogue);

      characterSet.add(charName);
      pushBlock('dialogue', extracted.cleanText, {
        character: charName,
        emotion: extracted.emotion,
      });
      index += 1;
      continue;
    }

    // 3. Standard screenplay / Fountain character cue block
    const nextNonEmpty = lines[index + 1];
    if (isLikelyCharacterCue(trimmed, nextNonEmpty)) {
      const cueMatch = trimmed.match(CHARACTER_CUE_RE)!;
      const charName = cleanTitleCaseName(cueMatch[1]);
      const qualifier = cueMatch[2]?.trim();
      characterSet.add(charName);

      index += 1;
      let emotion = 'Neutral';
      const dialogueParts: string[] = [];

      while (index < lines.length) {
        const subLine = lines[index].trim();
        if (!subLine) {
          break;
        }
        const parenMatch = subLine.match(PARENTHETICAL_RE);
        if (parenMatch) {
          const captured = (parenMatch[1] || parenMatch[2] || '').trim();
          if (dialogueParts.length === 0) {
            emotion = captured || 'Neutral';
          } else {
            // Mid-speech parenthetical: flush current dialogue and start next beat with emotion
            pushBlock('dialogue', dialogueParts.join(' '), {
              character: charName,
              qualifier,
              emotion,
            });
            dialogueParts.length = 0;
            emotion = captured || 'Neutral';
          }
          index += 1;
          continue;
        }

        dialogueParts.push(subLine);
        index += 1;
      }

      if (dialogueParts.length > 0) {
        pushBlock('dialogue', dialogueParts.join(' '), {
          character: charName,
          qualifier,
          emotion,
        });
      }
      continue;
    }

    // 4. Action / Stage Direction paragraph
    const actionLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        SCENE_HEADING_RE.test(nextTrimmed) ||
        COLON_DIALOGUE_RE.test(nextTrimmed) ||
        isLikelyCharacterCue(nextTrimmed, lines[index + 1])
      ) {
        break;
      }
      actionLines.push(nextTrimmed);
      index += 1;
    }
    pushBlock('action', actionLines.join(' '));
  }

  return {
    title,
    blocks,
    characters: Array.from(characterSet),
  };
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

export function parseFdxXml(
  xmlText: string,
  fallbackTitle = 'Imported Screenplay'
): ParsedScript {
  const blocks: ScriptBlock[] = [];
  const characterSet = new Set<string>();
  let lineCounter = 1;

  const paragraphRegex = /<Paragraph\b[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let currentCharacter: string | null = null;
  let currentQualifier: string | undefined;
  let currentEmotion = 'Neutral';

  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xmlText)) !== null) {
    const paraType = match[1];
    const inner = match[2];
    const textMatches = Array.from(inner.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi));
    const fullText = decodeXmlEntities(
      textMatches.map((m) => m[1].replace(/<[^>]+>/g, '')).join('')
    ).trim();

    if (!fullText) continue;

    if (paraType === 'Scene Heading') {
      currentCharacter = null;
      blocks.push({
        id: `blk-${lineCounter}`,
        type: 'scene',
        text: fullText,
        emotion: 'Neutral',
        lineNumber: lineCounter++,
      });
    } else if (paraType === 'Action') {
      currentCharacter = null;
      blocks.push({
        id: `blk-${lineCounter}`,
        type: 'action',
        text: fullText,
        emotion: 'Neutral',
        lineNumber: lineCounter++,
      });
    } else if (paraType === 'Character') {
      const cueMatch = fullText.match(CHARACTER_CUE_RE);
      currentCharacter = cleanTitleCaseName(cueMatch ? cueMatch[1] : fullText);
      currentQualifier = cueMatch?.[2];
      currentEmotion = 'Neutral';
      characterSet.add(currentCharacter);
    } else if (paraType === 'Parenthetical') {
      currentEmotion = fullText.replace(/^\(|\)$/g, '').trim() || 'Neutral';
    } else if (paraType === 'Dialogue') {
      const speaker = currentCharacter || 'SPEAKER';
      characterSet.add(speaker);
      blocks.push({
        id: `blk-${lineCounter}`,
        type: 'dialogue',
        character: speaker,
        qualifier: currentQualifier,
        emotion: currentEmotion,
        text: fullText,
        lineNumber: lineCounter++,
      });
      currentEmotion = 'Neutral';
    }
  }

  return {
    title: fallbackTitle,
    blocks,
    characters: Array.from(characterSet),
  };
}

export function buildCastProfiles(
  blocks: ScriptBlock[],
  existingProfiles: Record<string, CharacterVoiceProfile>,
  presetOverrides?: Record<string, { voiceName: VoiceName; persona: string }>
): Record<string, CharacterVoiceProfile> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    if (block.type === 'dialogue' && block.character) {
      counts.set(block.character, (counts.get(block.character) || 0) + 1);
    }
  }

  const nextProfiles: Record<string, CharacterVoiceProfile> = {};
  let voiceIdx = 0;

  for (const [name, lineCount] of counts.entries()) {
    const existing = existingProfiles[name];
    const preset = presetOverrides?.[name];
    nextProfiles[name] = {
      name,
      voiceName:
        existing?.voiceName ||
        preset?.voiceName ||
        VOICE_CYCLE[voiceIdx % VOICE_CYCLE.length],
      persona:
        existing?.persona ??
        preset?.persona ??
        'Natural conversational theatrical read',
      lineCount,
    };
    voiceIdx += 1;
  }

  const narratorCount = blocks.filter(
    (b) => b.type === 'scene' || b.type === 'action'
  ).length;
  const existingNarrator = existingProfiles[NARRATOR_KEY];
  nextProfiles[NARRATOR_KEY] = {
    name: NARRATOR_KEY,
    voiceName: existingNarrator?.voiceName || 'Zephyr',
    persona:
      existingNarrator?.persona ??
      'Crisp, unobtrusive narrator reading scene headings and stage directions',
    lineCount: narratorCount,
  };

  return nextProfiles;
}

export function formatBlocksToRawScript(
  blocks: ScriptBlock[],
  title?: string
): string {
  const lines: string[] = [];
  if (title) {
    lines.push(`Title: ${title}`, '');
  }
  for (const block of blocks) {
    if (block.type === 'scene') {
      lines.push(block.text.toUpperCase(), '');
    } else if (block.type === 'action') {
      lines.push(block.text, '');
    } else if (block.type === 'dialogue') {
      const qual = block.qualifier ? ` (${block.qualifier})` : '';
      lines.push(`${block.character || 'SPEAKER'}${qual}`);
      if (block.emotion && block.emotion !== 'Neutral') {
        lines.push(`(${block.emotion})`);
      }
      lines.push(block.text, '');
    }
  }
  return lines.join('\n').trim();
}
