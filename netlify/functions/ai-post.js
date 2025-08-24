// netlify/functions/ai-post.js (CommonJS, no external libs)
const fetchFn = global.fetch;

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}

// naive HTML → text (good enough to feed the model)
function htmlToText(html='') {
  try {
    // remove scripts/styles
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    // remove tags
    html = html.replace(/<\/?[^>]+>/g, ' ');
    // entities
    html = html.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    // collapse spaces
    html = html.replace(/\s+/g, ' ').trim();
    return html;
  } catch {
    return '';
  }
}

async function fetchPageText(url) {
  const res = await fetchFn(url, { headers:{ 'User-Agent':'Mozilla/5.0 (AI-Post-Fetch)' } });
  if (!res.ok) throw new Error('Fetch failed '+res.status);
  const html = await res.text();
  const text = htmlToText(html);
  return { title: '', text };
}

async function llmWriteLong(text, srcUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      html: `<p class="notice">OPENAI_API_KEY is missing. Add it in Netlify → Site settings → Environment variables.</p><p>${text.slice(0,1500)}</p>`,
      images: []
    };
  }

  const sys = `You are an editor for a West Bengal jobs website. Write an original, well-structured 2,000–3,000 word article for job seekers, based on the provided source text. Use H2/H3 headings, bullets, tables when helpful. Cover: overview, key dates, vacancy & eligibility, selection process, how to apply (steps), documents required, fees, salary, important links (as plain text), FAQs. Avoid copying exact sentences. End with "Always verify on the official website." If details are missing, say "Check official notice".`;
  const user = `SOURCE URL: ${srcUrl}
SOURCE TEXT (trimmed to 12k chars):
${text.slice(0, 12000)}
Task: Write the article in HTML fragments (no <html> tag).`;

  const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.4
    })
  });
  if (!r.ok) throw new Error('LLM error ' + (await r.text()));
  const j = await r.json();
  const content = (j.choices?.[0]?.message?.content || '').trim();

  // simple prompts
  const images = [
    'Wide banner, dark theme, Kolkata skyline, West Bengal recruitment news, minimalist',
    'Illustration of online job application, WB govt motif, clean vector',
    'Infographic style eligibility & dates, subtle icons, readable'
  ];
  return { html: content, images };
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');

    // selftest
    if (qs.get('selftest') === '1') {
      return json(200, {
        ok: true,
        openai_key_present: !!process.env.OPENAI_API_KEY
      });
    }

    const link = qs.get('link');
    if (!link) return json(400, { error: 'Missing link param' });

    const { text } = await fetchPageText(link);
    if (!text) return json(200, { title:'', html:'<p>No readable content from source.</p>', images: [] });

    const out = await llmWriteLong(text, link);
    return json(200, out);
  } catch (e) {
    return json(500, { error: e.message });
  }
};
