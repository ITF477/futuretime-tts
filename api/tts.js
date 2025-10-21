// /api/tts.js — Vercel Edge Function (streams MP3; sets CORS on every path)
export const config = { runtime: 'edge' };

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
function corsJSON() {
  return { ...cors(), 'Content-Type': 'application/json' };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok:false, error:'Method Not Allowed' }), { status:405, headers: corsJSON() });
  }

  try {
    const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_KEY) {
      return new Response(JSON.stringify({ ok:false, error:'Missing ELEVENLABS_API_KEY' }), { status:500, headers: corsJSON() });
    }

    const body = await req.json().catch(() => ({}));
    const { text, voice_id, model_id, stability, similarity } = body || {};
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ ok:false, error:'Missing "text"' }), { status:400, headers: corsJSON() });
    }

    const voice = voice_id || (process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM');
    const model = model_id || 'eleven_turbo_v2';

    // STREAMING endpoint to avoid timeouts
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=0`;

    // Abort if upstream stalls too long (prevents platform 504)
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 28000); // ~28s watchdog

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
        voice_settings: {
          stability: typeof stability === 'number' ? stability : 0.5,
          similarity_boost: typeof similarity === 'number' ? similarity : 0.8
        }
      }),
      signal: ac.signal
    }).finally(() => clearTimeout(t));

    if (!upstream.ok) {
      const detail = await upstream.text().catch(()=>'');
      return new Response(JSON.stringify({ ok:false, error:'Upstream TTS failed', detail }), { status:502, headers: corsJSON() });
    }

    // Return streamed MP3 with CORS headers
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...cors(),
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    const msg = String(err && (err.name || err.message) || err);
    return new Response(JSON.stringify({ ok:false, error:'Server error', detail: msg }), { status:500, headers: corsJSON() });
  }
}
