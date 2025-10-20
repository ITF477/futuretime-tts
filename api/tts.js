// /api/tts — Vercel Serverless Function (ESM)
export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }

    // Parse JSON body (Vercel parses automatically for ESM; guard anyway)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { text, voice_id, model_id, stability, similarity } = body;

    if (!text || !text.trim()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Missing text' });
    }

    const VOICE_ID = voice_id || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const MODEL_ID = model_id || 'eleven_multilingual_v2';

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: typeof stability === 'number' ? stability : 0.4,
          similarity_boost: typeof similarity === 'number' ? similarity : 0.8
        }
      })
    });

    if (!r.ok) {
      const errTxt = await r.text().catch(()=> '');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({ error: 'ElevenLabs error', details: errTxt });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Server error' });
  }
}

// api/tts.js
// Node serverless function on Vercel

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;

// Common CORS headers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    const { text, voice_id } = req.body || {};
    if (!text || typeof text !== 'string') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ ok: false, error: 'Missing "text"' });
    }

    // Use your default voice if not provided from the client
    const voice = voice_id || 'hod33eJyEU4TLqiYFttr'; // your “hod33e…” voice

    // ElevenLabs TTS (non-streaming) — returns an MP3 buffer
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2', // good default; change if needed
        voice_settings: { stability: 0.5, similarity_boost: 0.8 }
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({ ok: false, error: 'Upstream TTS failed', detail: errText });
    }

    const arrayBuf = await r.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Return MP3 with CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(err) });
  }
}

