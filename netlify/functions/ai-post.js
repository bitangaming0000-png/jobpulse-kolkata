// netlify/functions/ai-post.js
const fetchFn = global.fetch;

function reply(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}

function htmlToText(html='') {
  try {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/&nbsp;/g,' ')
      .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
      .replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

function normalizeUrl(raw) {
  if (!raw) return null;
  let s = decodeURIComponent(String(raw).trim());
  if (/^<.*?>$/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}

async function fetchPageText(url) {
  const res = await fetchFn(url, { headers:{ 'User-Agent':'Mozilla/5.0 (JobPulse-AI/1.0)' } });
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const html = await res.text();
  return htmlToText(html);
}

function buildFallbackFrom(text, srcUrl, reasonMsg) {
  const safe = (text || '').slice(0, 2000);
  return `
  <div class="notice"><strong>AI is temporarily unavailable.</strong> ${reasonMsg || ''}</div>
  <h2>Quick Summary (Auto)</h2>
  <p>${safe || 'Source text unavailable.'}</p>
  <p class="badge">Source: ${srcUrl ? srcUrl : 'N/A'}</p>
  <p class="badge">Tip: Try again later, or verify on the official website.</p>`;
}

async function llmWriteLong(text, srcUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const base = { images: [] };

  if (!apiKey) {
    return { ...base, html: buildFallbackFrom(text, srcUrl, 'Missing API key.') , ai_disabled: 'no_key' };
  }

  const sys = `You are an editor for a West Bengal jobs website. Write an original, structured 2,000–3,000 word article for job seekers based on the provided source text. Use H2/H3, bullets, and tables when useful. Cover: overview, key dates, vacancy & eligibility, selection process, how to apply (steps), documents, fees, salary, important links (plain text), FAQs. Avoid copying sentences. End with "Always verify on the official website." If details are missing, say "Check official notice".`;
  const user = `SOURCE URL: ${srcUrl || 'N/A'}
SOURCE TEXT (trimmed to 12k chars):
${(text || '').slice(0, 12000)}
Task: Return ONLY HTML fragments (no <html> tag).`;

  const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role:'system', content: sys }, { role:'user', content: user }], temperature: 0.4 })
  });

  if (!r.ok) {
    let note = 'AI request failed.';
    try {
      const err = await r.json();
      if (err?.error?.code === 'insufficient_quota') {
        return { ...base, html: buildFallbackFrom(text, srcUrl, 'Quota exceeded on the AI provider.'), ai_disabled: 'quota' };
      }
      note = (err?.error?.message) ? `AI error: ${err.error.message}` : note;
    } catch {
      // ignore parse error
    }
    return { ...base, html: buildFallbackFrom(text, srcUrl, note), ai_disabled: 'error' };
  }

  const j = await r.json();
  const content = (j.choices?.[0]?.message?.content || '').trim();
  if (!content) return { ...base, html: buildFallbackFrom(text, srcUrl, 'Empty AI response.'), ai_disabled: 'empty' };
  return { ...base, html: content };
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');
    if (qs.get('selftest') === '1') {
      return reply(200, { ok: true, openai_key_present: !!process.env.OPENAI_API_KEY });
    }

    // text mode (fallback/testing)
    const directText = qs.get('text');
    if (directText && directText.trim().length > 30) {
      const out = await llmWriteLong(directText.trim(), null);
      return reply(200, out);
    }

    // URL mode
    const rawLink = qs.get('link');
    const link = normalizeUrl(rawLink);
    if (!link) {
      return reply(200, { html: buildFallbackFrom('', '', 'Invalid or missing link.'), ai_disabled: 'bad_link', images: [] });
    }

    let text = '';
    try { text = await fetchPageText(link); }
    catch { return reply(200, { html: buildFallbackFrom('', link, 'Could not fetch the source URL.'), ai_disabled: 'fetch', images: [] }); }

    if (!text) return reply(200, { html: buildFallbackFrom('', link, 'No readable content found.'), ai_disabled: 'nobody', images: [] });

    const out = await llmWriteLong(text, link);
    return reply(200, out);
  } catch (e) {
    return reply(200, { html: buildFallbackFrom('', '', 'Unexpected error: ' + e.message), ai_disabled: 'exception', images: [] });
  }
};
