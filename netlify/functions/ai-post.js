// netlify/functions/ai-post.js (CommonJS, robust + always returns html)
const fetchFn = global.fetch;

function reply(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}

// simple HTML → text
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
  if (/^<.*?>$/.test(s) || s.toLowerCase().includes('any-news-url')) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}

async function fetchPageText(url) {
  const res = await fetchFn(url, {
    headers:{ 'User-Agent':'Mozilla/5.0 (JobPulse-AI/1.0)' }
  });
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const html = await res.text();
  return htmlToText(html);
}

async function llmWriteLong(text, srcUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const base = {
    images: [
      'Wide banner, dark theme, Kolkata skyline, WB recruitment news, minimalist',
      'Illustration of online job application, WB govt motif, clean vector',
      'Infographic: eligibility checklist, key dates, readable icons'
    ]
  };

  if (!apiKey) {
    return {
      ...base,
      html: `<p class="notice">OPENAI_API_KEY is missing. Add it in Netlify → Site settings → Environment variables, then redeploy.</p>
<p><strong>Quick summary from source text:</strong> ${text.slice(0, 1500)}</p>`
    };
  }

  const sys = `You are an editor for a West Bengal jobs website. Write an original, structured 2,000–3,000 word article for job seekers based on the provided source text. Use H2/H3, bullets, tables if useful. Cover: overview, key dates, vacancy & eligibility, selection process, how to apply (steps), documents, fees, salary, important links (plain text), FAQs. Avoid copying sentences. End with "Always verify on the official website." If details are missing, say "Check official notice".`;
  const user = `SOURCE URL: ${srcUrl || 'N/A'}
SOURCE TEXT (trimmed to 12k chars):
${text.slice(0, 12000)}
Task: Return ONLY HTML fragments (no <html> tag).`;

  const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.4
    })
  });

  if (!r.ok) {
    const msg = await r.text();
    return {
      ...base,
      html: `<p class="notice">AI request failed.</p><pre>${msg.slice(0, 2000)}</pre>`
    };
  }

  const j = await r.json();
  const content = (j.choices?.[0]?.message?.content || '').trim();
  return { ...base, html: content || `<p class="notice">AI returned empty content.</p>` };
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');
    if (qs.get('selftest') === '1') {
      return reply(200, {
        ok: true,
        openai_key_present: !!process.env.OPENAI_API_KEY
      });
    }

    // 1) Text mode (fallback/testing)
    const directText = qs.get('text');
    if (directText && directText.trim().length > 30) {
      const out = await llmWriteLong(directText.trim(), null);
      return reply(200, out);
    }

    // 2) URL mode
    const rawLink = qs.get('link');
    const link = normalizeUrl(rawLink);
    if (!link) {
      return reply(200, {
        html: `<p class="notice">Invalid or missing link. Using fallback text mode instead.</p>`,
        images: []
      });
    }

    let text = '';
    try {
      text = await fetchPageText(link);
    } catch (e) {
      // Failed to fetch the URL — still return usable HTML so the page doesn’t go blank
      return reply(200, {
        html: `<p class="notice">Could not fetch the source URL (network blocked or site denied access). Try again later or use text mode.</p>
<p><strong>Source attempted:</strong> ${link}</p>`,
        images: []
      });
    }

    if (!text) {
      return reply(200, { html: `<p>No readable content from the source page.</p>`, images: [] });
    }

    const out = await llmWriteLong(text, link);
    return reply(200, out);
  } catch (e) {
    // Always return an HTML fragment so the page shows something
    return reply(200, {
      html: `<p class="notice">AI article generation hit an error:</p><pre>${(e.message||'').slice(0,2000)}</pre>`,
      images: []
    });
  }
};
