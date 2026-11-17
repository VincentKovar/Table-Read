import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const VALID_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your environment Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function buildStylePrompt(persona?: string, emotion?: string): string {
  const cleanPersona = (persona || '').trim();
  const cleanEmotion = (emotion || '').trim();
  const hasEmotion = cleanEmotion && cleanEmotion.toLowerCase() !== 'neutral';

  if (cleanPersona && hasEmotion) {
    return `${cleanPersona}. Emotional delivery: ${cleanEmotion}.`;
  }
  if (hasEmotion) {
    return `Natural theatrical table read. Emotional delivery: ${cleanEmotion}.`;
  }
  if (cleanPersona) {
    return cleanPersona;
  }
  return 'Natural, clear theatrical table read delivery.';
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: 'gemini-3.8-flash-tts' });
  });

  app.post('/api/tts/line', async (req, res) => {
    try {
      const body = req.body as {
        text?: string;
        voiceName?: string;
        persona?: string;
        emotion?: string;
      };

      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const voiceName =
        typeof body.voiceName === 'string' && VALID_VOICES.has(body.voiceName)
          ? body.voiceName
          : 'Kore';

      if (!text) {
        res.status(400).json({ error: 'Line text is required for synthesis.' });
        return;
      }

      const style = buildStylePrompt(body.persona, body.emotion);
      const ai = getAiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
      );

      const inlineData =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error:
            'Gemini TTS returned an empty audio response for this line. Try adjusting the text or delivery note.',
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: inlineData?.mimeType || 'audio/wav',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected TTS synthesis error.';
      const status = message.includes('GEMINI_API_KEY')
        ? 500
        : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/script/suggest-emotions', async (req, res) => {
    try {
      const body = req.body as {
        title?: string;
        lines?: Array<{
          id: string;
          type: string;
          character?: string;
          text: string;
        }>;
      };

      const lines = Array.isArray(body.lines) ? body.lines : [];
      const dialogueLines = lines.filter(
        (l) => l.type === 'dialogue' && typeof l.text === 'string' && l.text.trim()
      );

      if (dialogueLines.length === 0) {
        res.status(400).json({ error: 'No dialogue lines found to analyze.' });
        return;
      }

      const ai = getAiClient();
      const scriptTranscript = dialogueLines
        .slice(0, 60)
        .map((l) => `[${l.id}] ${l.character || 'SPEAKER'}: ${l.text}`)
        .join('\n');

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analyze these dialogue lines from "${body.title || 'Script'}" and suggest a short, playable acting emotion or vocal delivery note (2-4 words, e.g., "quietly, guarded", "urgent, breathless", "warm, amused", "sharp, suspicious") for each line ID.\n\n${scriptTranscript}`,
          config: {
            systemInstruction:
              'You are a voice director preparing actors for a table read. Return concise, natural emotional delivery labels (2 to 4 words max) tailored to each line.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: 'The block ID matching the input line.',
                  },
                  emotion: {
                    type: Type.STRING,
                    description: 'Concise 2-4 word acting emotion/delivery.',
                  },
                },
                required: ['id', 'emotion'],
              },
            },
          },
        })
      );

      const jsonText = (response.text ?? '[]').trim();
      const suggestions = JSON.parse(jsonText) as Array<{
        id: string;
        emotion: string;
      }>;

      res.json({ suggestions });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to suggest line emotions.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TableRead Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
