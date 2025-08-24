// netlify/functions/ai-image.js
const fetchFn = global.fetch;
function json(status, obj){ return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) }; }

module.exports.handler = async (event) => {
  try{
    const qs = new URLSearchParams(event.rawQuery||'');
    if (qs.get('selftest') === '1') return json(200, { ok:true, openai_key_present: !!process.env.OPENAI_API_KEY });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(200, { dataUrl:null, ai_disabled:'no_key', note:'OPENAI_API_KEY missing' });

    const prompt = qs.get('prompt') || 'Kolkata skyline recruitment banner, dark theme, minimalist';
    const r = await fetchFn('https://api.openai.com/v1/images/generations', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body: JSON.stringify({ model:'gpt-image-1', prompt, size:'1024x576' })
    });

    if (!r.ok) {
      let ai_disabled='error'; let note='Image API error';
      try {
        const err = await r.json();
        if (err?.error?.code === 'insufficient_quota') { ai_disabled='quota'; note='Quota exceeded'; }
        else if (err?.error?.message) note = err.error.message;
      } catch {}
      return json(200, { dataUrl:null, ai_disabled, note });
    }

    const j = await r.json();
    const b64 = j.data?.[0]?.b64_json;
    return json(200, { dataUrl: b64 ? `data:image/png;base64,${b64}` : null });
  }catch(e){
    return json(200, { dataUrl:null, ai_disabled:'exception', note:e.message });
  }
};
