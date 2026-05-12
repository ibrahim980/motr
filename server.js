import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

if (!GEMINI_API_KEY) {
  console.warn('[server] GEMINI_API_KEY is not set — /api/scan-odometer will return 503');
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const app = express();
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(ai) });
});

app.post('/api/scan-odometer', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
  }
  const { image, mimeType } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing "image" (base64 string) in body' });
  }
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            {
              text: 'Extract the odometer reading (mileage) from this dashboard image. Also try to identify the car make and model if possible. Return the data in JSON format.',
            },
            {
              inlineData: {
                mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
                data: image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mileage: { type: Type.NUMBER, description: 'The number shown on the odometer' },
            make: { type: Type.STRING, description: 'Detected car brand' },
            model: { type: Type.STRING, description: 'Detected car model' },
            confidence: { type: Type.NUMBER, description: 'Confidence score between 0 and 1' },
          },
          required: ['mileage', 'confidence'],
        },
      },
    });
    const text = response.text;
    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }
    res.json(JSON.parse(text));
  } catch (err) {
    console.error('[scan-odometer]', err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
if (fs.existsSync(indexFile)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(indexFile);
  });
} else {
  console.log('[server] dist/ not found — API-only mode (run "npm run build" for static serving)');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
});
