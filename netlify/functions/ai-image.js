// netlify/functions/ai-image.js (CommonJS)
const fetchFn = global.fetch;

function json(status, obj){
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) };
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');
    if (qs.get('selftest') === '1') {
      return json(200, { ok: true, openai_key_present: !!process.env.OPENAI_API_KEY });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(200, { dataUrl: null, note: 'OPENAI_API_KEY missing in environment' });

    const prompt = qs.get('prompt') || 'Kolkata skyline recruitment banner, dark theme, minimalist, high-contrast';
    const r = await fetchFn('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x576' })
    });
    if (!r.ok) throw new Error('Image API error ' + (await r.text()));
    const j = await r.json();
    const b64 = j.data?.[0]?.b64_json;
    const dataUrl = b64 ? `data:image/png;base64,${b64}` : null;
    return json(200, { dataUrl });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
