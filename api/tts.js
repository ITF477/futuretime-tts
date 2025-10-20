// /api/tts.js — Vercel Serverless Function (Node runtime)

export const config = {
  runtime: 'nodejs20.x', // ensure modern fetch/Buffer
};

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // change if you like

// Common CORS
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', CORS['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', CORS['Access-Control-Allow-Headers']);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    if (!ELEVEN_KEY) {
      res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
      return res.status(500).json({ ok: false, error: 'Missing ELEVENLABS_API_KEY' });
    }

    // Vercel API routes usually give you an object for req.body; guard for string just in case
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { text, voice_id, model_id, stability, similarity } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
      return res.status(400).json({ ok: false, error: 'Missing "text"' });
    }

    const voice = voice_id || DEFAULT_VOICE;
    const model = model_id || 'eleven_turbo_v2';

    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
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
      res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
      retu
