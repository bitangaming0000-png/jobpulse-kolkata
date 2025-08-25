// netlify/functions/ai-post.js (CommonJS, robust URL handling + text mode + safe fallbacks)
const fetchFn = global.fetch;

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}

// naive HTML → text for model input
function htmlToText(html='') {
  try {
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<\/?[^>]+>/g, ' ')
               .replace(/&nbsp;/g,' ')
               .replace(/&amp;/g,'&')
               .replace(/&quot;/g,'"')
               .replace(/&#39;/g,"'")
               .replace(/&lt;/g,'<')
               .replace(/&gt;/g,'>')
               .replace(/\s+/g, ' ').trim();
    return html;
  } catch { return ''; }
}

function normalizeUrl(raw) {
  if (!raw) return null;
  let s = decodeURIComponent(String(raw).trim());
  if (/^<.*?>$/.test(s) || s.toLowerCase().includes('any-news-url')) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}

async function fetchPageText(url) {
  const res = await fetchFn(url, { headers:{ 'User-Agent':'Mozilla/5.0 (JobPulse-AI/1.0)' } });
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const html = await res.text();
  return htmlToText(html);
}

async function llmWriteLong(text, srcUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseHTML = `<h2>Quick Summary</h2><p>${text ? text.slice(0, 900) : 'No source text available.'}</p>`;

  if (!apiKey) {
    return {
      html: `<p class="notice">OPENAI_API_KEY is missing. Add it in Netlify → Site settings → Environment variables, then redeploy.</p>${baseHTML}`,
      images: []
    };
  }

  const sys = `You are an editor for a West Bengal jobs website. Write an original, structured 2,000–3,000 word article for job seekers based on the provided source text. Use H2/H3, bullets, and tables when useful. Cover: overview, key dates, vacancy & eligibility, selection process, how to apply (steps), documents, fees, salary, important links (plain text), FAQs. Avoid copying exact sentences. End with "Always verify on the official website." If details are missing, say "Check official notice".`;
  const user = `SOURCE URL: ${srcUrl || 'N/A'}
SOURCE TEXT (trimmed to 12k chars):
${(text || '').slice(0, 12000)}
Task: Return ONLY HTML fragments (no <html> tag).`;

  try {
    const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'system', content: sys }, { role:'user', content: user }],
        temperature: 0.4
      })
    });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const content = (j.choices?.[0]?.message?.content || '').trim() || baseHTML;

    return {
      html: content,
      images: [
        'Wide banner, dark theme, Kolkata skyline, West Bengal recruitment news, minimalist',
        'Illustration of online job application, WB govt motif, clean vector',
        'Infographic: eligibility checklist, key dates, readable, subtle icons'
      ]
    };
  } catch (e) {
    // Final fallback – never return empty
    return { html: baseHTML + `<p class="muted">AI generation error: ${String(e).slice(0,180)}</p>`, images: [] };
  }
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');

    if (qs.get('selftest') === '1') {
      return json(200, { ok: true, openai_key_present: !!process.env.OPENAI_API_KEY });
    }

    const directText = qs.get('text');
    if (directText && directText.trim().length > 30) {
      const out = await llmWriteLong(directText.trim(), null);
      return json(200, out);
    }

    const rawLink = qs.get('link');
    const link = normalizeUrl(rawLink);
    if (!link) {
      // Safe fallback in case of missing/invalid URL
      const out = await llmWriteLong('', null);
      return json(200, out);
    }

    let text = '';
    try { text = await fetchPageText(link); } catch { text = ''; }

    const out = await llmWriteLong(text, link);
    return json(200, out);
  } catch (e) {
    const out = await llmWriteLong('', null);
    return json(200, out);
  }
};
