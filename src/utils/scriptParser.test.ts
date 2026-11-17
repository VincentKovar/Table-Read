import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCastProfiles,
  formatBlocksToRawScript,
  parseFdxXml,
  parseScriptText,
} from './scriptParser';

test('parseScriptText parses Fountain/screenplay format with parenthetical emotions', () => {
  const raw = `Title: Midnight Diner

INT. HARBOR DINER - NIGHT

Rain taps against the neon-lit glass.

DETECTIVE MARA
(quietly, leaning in)
You told me the ledger burned in the warehouse fire.

ELENA (V.O.)
(hesitant, trembling)
I told you what kept us both alive.
`;

  const parsed = parseScriptText(raw);
  assert.equal(parsed.title, 'Midnight Diner');
  assert.deepEqual(parsed.characters, ['DETECTIVE MARA', 'ELENA']);
  assert.equal(parsed.blocks.length, 4);

  assert.equal(parsed.blocks[0].type, 'scene');
  assert.equal(parsed.blocks[0].text, 'INT. HARBOR DINER - NIGHT');

  assert.equal(parsed.blocks[1].type, 'action');
  assert.equal(parsed.blocks[1].text, 'Rain taps against the neon-lit glass.');

  assert.equal(parsed.blocks[2].type, 'dialogue');
  assert.equal(parsed.blocks[2].character, 'DETECTIVE MARA');
  assert.equal(parsed.blocks[2].emotion, 'quietly, leaning in');
  assert.equal(
    parsed.blocks[2].text,
    'You told me the ledger burned in the warehouse fire.'
  );

  assert.equal(parsed.blocks[3].type, 'dialogue');
  assert.equal(parsed.blocks[3].character, 'ELENA');
  assert.equal(parsed.blocks[3].qualifier, 'V.O.');
  assert.equal(parsed.blocks[3].emotion, 'hesitant, trembling');
});

test('parseScriptText parses stage play colon format with inline emotions', () => {
  const raw = `ALICE (excited): We actually cracked the vault code!
BOB [suspicious]: Then why is the red light still blinking?
MARCUS: Step back from the console.`;

  const parsed = parseScriptText(raw, 'Stage Test');
  assert.equal(parsed.title, 'Stage Test');
  assert.deepEqual(parsed.characters, ['ALICE', 'BOB', 'MARCUS']);
  assert.equal(parsed.blocks.length, 3);

  assert.equal(parsed.blocks[0].character, 'ALICE');
  assert.equal(parsed.blocks[0].emotion, 'excited');
  assert.equal(parsed.blocks[0].text, 'We actually cracked the vault code!');

  assert.equal(parsed.blocks[1].character, 'BOB');
  assert.equal(parsed.blocks[1].emotion, 'suspicious');
  assert.equal(parsed.blocks[1].text, 'Then why is the red light still blinking?');

  assert.equal(parsed.blocks[2].character, 'MARCUS');
  assert.equal(parsed.blocks[2].emotion, 'Neutral');
});

test('parseFdxXml extracts Final Draft paragraphs accurately', () => {
  const fdx = `<?xml version="1.0" encoding="UTF-8" ?>
<FinalDraft DocumentType="Script">
  <Content>
    <Paragraph Type="Scene Heading"><Text>EXT. ROOFTOP - DAWN</Text></Paragraph>
    <Paragraph Type="Character"><Text>JULES</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(breathless)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>We&apos;re out of time &amp; options.</Text></Paragraph>
  </Content>
</FinalDraft>`;

  const parsed = parseFdxXml(fdx, 'Rooftop Draft');
  assert.equal(parsed.title, 'Rooftop Draft');
  assert.deepEqual(parsed.characters, ['JULES']);
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].type, 'scene');
  assert.equal(parsed.blocks[1].emotion, 'breathless');
  assert.equal(parsed.blocks[1].text, "We're out of time & options.");
});

test('buildCastProfiles preserves existing voices and assigns distinct defaults', () => {
  const parsed = parseScriptText(`ALICE: Hello.\nBOB: Hi there.`);
  const initial = buildCastProfiles(parsed.blocks, {});
  assert.equal(initial['ALICE'].lineCount, 1);
  assert.equal(initial['BOB'].lineCount, 1);
  assert.notEqual(initial['ALICE'].voiceName, initial['BOB'].voiceName);

  const updated = buildCastProfiles(parsed.blocks, {
    ALICE: { ...initial['ALICE'], voiceName: 'Zephyr', persona: 'Bright' },
  });
  assert.equal(updated['ALICE'].voiceName, 'Zephyr');
  assert.equal(updated['ALICE'].persona, 'Bright');
});

test('formatBlocksToRawScript round-trips cleanly', () => {
  const raw = `Title: Roundtrip\n\nINT. STUDIO - DAY\n\nKAI\n(warm)\nReady to roll.\n`;
  const parsed = parseScriptText(raw);
  const formatted = formatBlocksToRawScript(parsed.blocks, parsed.title);
  const reparsed = parseScriptText(formatted);
  assert.equal(reparsed.title, 'Roundtrip');
  assert.equal(reparsed.blocks.length, 2);
  assert.equal(reparsed.blocks[1].emotion, 'warm');
});
