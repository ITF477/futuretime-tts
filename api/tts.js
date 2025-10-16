// Vercel Serverless Function: /api/tts
// Set env vars in Vercel: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional)

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { text, voice_id, model_id, stability, similarity } = body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Missing text' });

    const VOICE_ID = voice_id || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // example default
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
    res.setHeader('Access-Control-Allow-Origin', '*');  // allow Webflow origin
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
};
