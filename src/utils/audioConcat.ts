import { Mp3Encoder } from '@breezystack/lamejs';

export interface DecodedWav {
  pcm: Int16Array;
  sampleRate: number;
  numChannels: number;
  durationSeconds: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function decodeWavBase64ToPcm(base64: string): DecodedWav {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < 44) {
    throw new Error('Invalid WAV buffer: shorter than 44 bytes.');
  }

  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV header: missing RIFF/WAVE signature.');
  }

  let offset = 12;
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, bytes.byteLength - dataOffset);
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) {
    dataOffset = 44;
    dataLength = bytes.byteLength - 44;
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}-bit.`);
  }

  const sampleCount = Math.floor(dataLength / 2);
  const pcm = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    pcm[i] = view.getInt16(dataOffset + i * 2, true);
  }

  const totalFrames = sampleCount / Math.max(1, numChannels);
  const durationSeconds = totalFrames / sampleRate;

  return {
    pcm,
    sampleRate,
    numChannels,
    durationSeconds,
  };
}

export function createSilencePcm(
  durationMs: number,
  sampleRate = 24000
): Int16Array {
  const sampleCount = Math.max(0, Math.round((durationMs / 1000) * sampleRate));
  return new Int16Array(sampleCount);
}

export function concatenatePcmSegments(
  segments: Int16Array[],
  gapMs = 350,
  sampleRate = 24000
): Int16Array {
  if (segments.length === 0) {
    return new Int16Array(0);
  }

  const gapSamples = Math.max(0, Math.round((gapMs / 1000) * sampleRate));
  let totalSamples = 0;
  for (let i = 0; i < segments.length; i += 1) {
    totalSamples += segments[i].length;
    if (i < segments.length - 1) {
      totalSamples += gapSamples;
    }
  }

  const output = new Int16Array(totalSamples);
  let cursor = 0;
  for (let i = 0; i < segments.length; i += 1) {
    output.set(segments[i], cursor);
    cursor += segments[i].length;
    if (i < segments.length - 1) {
      cursor += gapSamples;
    }
  }
  return output;
}

export function encodePcmToWav(
  pcm: Int16Array,
  sampleRate = 24000,
  numChannels = 1
): Uint8Array {
  const dataByteLength = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataByteLength, true);

  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(44 + i * 2, pcm[i], true);
  }

  return new Uint8Array(buffer);
}

export function encodePcmToMp3(
  pcm: Int16Array,
  sampleRate = 24000,
  kbps = 192
): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < pcm.length; i += blockSize) {
    const slice = pcm.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(slice);
    if (encoded.length > 0) {
      mp3Chunks.push(new Uint8Array(encoded));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(new Uint8Array(flushed));
  }

  const totalBytes = mp3Chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
