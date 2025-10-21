// /api/tts.js — Vercel Edge Function (streams MP3 + CORS)
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')   return json({ ok:false, error:'Method Not Allowed' }, 405);

  try {
    const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_KEY) return json({ ok:false, error:'Missing ELEVENLABS_API_KEY' }, 500);

    const body = await req.json().catch(()=> ({}));
    const { text, voice_id, model_id, stability, similarity, speaking_rate } = body || {};
    if (!text || !text.trim()) return json({ ok:false, error:'Missing "text"' }, 400);

    const voice = voice_id || (process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM');
    const model = model_id || 'eleven_turbo_v2';

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=0`;

    const ac = new AbortController();
    const watchdog = setTimeout(() => ac.abort(), 28000);

    // Build voice_settings and include speaking_rate only if set or you want a default
    const voiceSettings = {
      stability: typeof stability === 'number' ? stability : 0.5,
      similarity_boost: typeof similarity === 'number' ? similarity : 0.8,
      // If you want to force faster speech globally, keep the next line.
      // If you only want it sometimes, pass speaking_rate in the POST body instead.
      ...(typeof speaking_rate === 'number' ? { speaking_rate } : { speaking_rate: 1.2 })
    };

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: voiceSettings
      }),
      signal: ac.signal
    }).finally(() => clearTimeout(watchdog));

    if (!upstream.ok) {
      const detail = await upstream.text().catch(()=> '');
      return json({ ok:false, error:'Upstream TTS failed', detail }, 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    return json({ ok:false, error:'Server error', detail: String(err) }, 500);
  }
}
