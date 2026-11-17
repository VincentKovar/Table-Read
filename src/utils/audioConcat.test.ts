import test from 'node:test';
import assert from 'node:assert/strict';
import {
  concatenatePcmSegments,
  createSilencePcm,
  decodeWavBase64ToPcm,
  encodePcmToMp3,
  encodePcmToWav,
  formatTimecode,
  uint8ArrayToBase64,
} from './audioConcat';

function createSineTonePcm(
  durationMs: number,
  sampleRate = 24000,
  freqHz = 440
): Int16Array {
  const count = Math.round((durationMs / 1000) * sampleRate);
  const pcm = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    pcm[i] = Math.round(Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * 12000);
  }
  return pcm;
}

test('WAV encode and decode round-trips PCM samples cleanly', () => {
  const tone = createSineTonePcm(250, 24000, 440);
  const wavBytes = encodePcmToWav(tone, 24000, 1);
  assert.equal(String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3]), 'RIFF');
  assert.equal(String.fromCharCode(wavBytes[8], wavBytes[9], wavBytes[10], wavBytes[11]), 'WAVE');

  const base64 = uint8ArrayToBase64(wavBytes);
  const decoded = decodeWavBase64ToPcm(base64);

  assert.equal(decoded.sampleRate, 24000);
  assert.equal(decoded.numChannels, 1);
  assert.equal(decoded.pcm.length, tone.length);
  assert.ok(Math.abs(decoded.durationSeconds - 0.25) < 0.001);
  assert.equal(decoded.pcm[100], tone[100]);
});

test('concatenatePcmSegments inserts exact silence gap between segments', () => {
  const seg1 = createSineTonePcm(100, 24000);
  const seg2 = createSineTonePcm(100, 24000);
  const combined = concatenatePcmSegments([seg1, seg2], 500, 24000);

  // 100ms + 500ms + 100ms = 700ms at 24kHz = 16800 samples
  assert.equal(combined.length, 16800);
  // Middle silence region should be 0
  assert.equal(combined[2400 + 5000], 0);
});

test('createSilencePcm returns expected length of zeroes', () => {
  const silence = createSilencePcm(250, 24000);
  assert.equal(silence.length, 6000);
  assert.equal(silence[0], 0);
  assert.equal(silence[5999], 0);
});

test('encodePcmToMp3 produces valid non-empty MP3 stream', () => {
  const tone = createSineTonePcm(600, 24000, 523.25);
  const mp3Bytes = encodePcmToMp3(tone, 24000, 192);
  assert.ok(mp3Bytes.length > 500, 'Expected non-trivial MP3 byte output');
  // MPEG audio frame sync starts with 0xFF and top 3 bits 0xE0
  assert.equal(mp3Bytes[0], 0xff);
  assert.equal((mp3Bytes[1] & 0xe0) === 0xe0, true);
});

test('formatTimecode formats MM:SS cleanly', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(9.9), '00:09');
  assert.equal(formatTimecode(75), '01:15');
});
