// /api/tts.js — Vercel Serverless Function (Node runtime, streaming)
export const config = { runtime: 'nodejs20.x' };

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', CORS['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', CORS['Access-Control-Allow-Headers']);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    if (!ELEVEN_KEY) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ ok: false, error: 'Missing ELEVENLABS_API_KEY' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { text, voice_id, model_id, stability, similarity } = body;
    if (!text || !text.trim()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ ok: false, error: 'Missing "text"' });
    }

    const voice = voice_id || DEFAULT_VOICE;
    const model = model_id || 'eleven_turbo_v2';

    // ✅ STREAMING endpoint (lower latency, avoids timeouts with long text)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=0`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: typeof stability === 'number' ? stability : 0.5,
          similarity_boost: typeof similarity === 'number' ? similarity : 0.8,
        },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({ ok: false, error: 'Upstream TTS failed', detail });
    }

    // Pipe the streamed MP3 to the client
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    // Node >=18: upstream.body is a web ReadableStream; pipe it to res
    const reader = upstream.body.getReader();
    const pump = async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    pump().catch(err => {
      console.error('Stream error:', err);
      try { res.end(); } catch(e){}
    });
  } catch (err) {
    console.error(err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(err) });
  }
}
