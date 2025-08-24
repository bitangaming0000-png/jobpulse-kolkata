// netlify/functions/ai-post.js
// Long-form article generator (5k+ words target) using source page text and images.
// - Uses OpenAI if available to produce ~4,500–6,000 words; if short, asks to "continue" once.
// - Extracts images from the source page (og:image, twitter:image, inline <img>).
// - If quota/key missing, returns a long structured fallback (non-AI).
// No AI images at all.

const fetchFn = global.fetch;

function reply(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}

// --- Utilities ---
function htmlToText(html='') {
  try {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
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
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}
function makeAbs(base, src) {
  try { return new URL(src, base).href; } catch { return null; }
}
function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = (x||'').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out;
}

// Extract images (og/twitter + <img src>)
function extractImages(html, pageUrl, limit=8) {
  const imgs = [];

  // og:image / twitter:image
  const metaImg = [...html.matchAll(/<meta[^>]+property=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)];
  metaImg.forEach(m => { const u = makeAbs(pageUrl, m[1]); if (u) imgs.push(u); });

  const metaImg2 = [...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["'](?:og:image|twitter:image)["'][^>]*>/gi)];
  metaImg2.forEach(m => { const u = makeAbs(pageUrl, m[1]); if (u) imgs.push(u); });

  // <img src="">
  const tagImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  tagImgs.forEach(m => {
    const u = makeAbs(pageUrl, m[1]);
    if (u && !/\.(svg|gif)$/i.test(u)) imgs.push(u);
  });

  // Clean absolute unique urls
  return uniq(imgs).slice(0, limit);
}

// Build a long fallback (non-AI) if quota missing
function buildLongFallback(title, summary, text, srcUrl) {
  const chunk = (s, n) => (s||'').slice(0, n);
  const base = htmlToText(summary || '').trim() || chunk(text, 1800);
  const body = htmlToText(text).slice(0, 20000);

  return `
  <h2>Overview</h2>
  <p>${title ? ('<strong>' + title + '</strong> — ') : ''}${base}</p>

  <h2>Key Highlights</h2>
  <ul>
    <li>Region focus: West Bengal job/recruitment update.</li>
    <li>Please verify dates, eligibility, and official notices on the source website.</li>
    <li>Use this article as a guide; final details may differ per official notification.</li>
  </ul>

  <h2>Important Dates</h2>
  <p>Check the official notification for exact dates (application start/end, admit card release, exam, results).</p>

  <h2>Vacancy & Eligibility (Reference)</h2>
  <p>If the source includes detailed vacancy and eligibility conditions (age, education, experience), please refer to those specifics. If unsure, visit the official portal linked below.</p>

  <h2>Selection Process</h2>
  <p>Common stages include written test, skill test/interview, and document verification. Refer to the official notice for syllabus and weightage.</p>

  <h2>How to Apply</h2>
  <ol>
    <li>Visit the official website.</li>
    <li>Find the recruitment/notification link relevant to your post.</li>
    <li>Read the detailed notification carefully.</li>
    <li>Register with valid email and mobile number (if required).</li>
    <li>Fill the application form and upload documents in the specified format.</li>
    <li>Pay the application fee (if applicable) and submit.</li>
    <li>Download/print the form and payment receipt for records.</li>
  </ol>

  <h2>Documents Required</h2>
  <ul>
    <li>Identity proof, recent passport-size photographs</li>
    <li>Educational certificates and marksheets</li>
    <li>Category/Reservation certificates (if applicable)</li>
    <li>Experience certificates (if required)</li>
  </ul>

  <h2>Application Fees & Salary</h2>
  <p>Refer to official notice for fee slabs and pay level; these vary by post and category.</p>

  <h2>Detailed Source Text (Auto Extract)</h2>
  <p>${body}</p>

  <h2>Important Links</h2>
  <p>Official Source: ${srcUrl ? `<a href="${srcUrl}" target="_blank" rel="noopener">${srcUrl}</a>` : 'N/A'}</p>

  <h2>FAQs</h2>
  <p><strong>Q1:</strong> Where can I confirm exact dates and eligibility?<br><strong>A:</strong> Always check the official website/notification.</p>
  <p><strong>Q2:</strong> Is this information applicable to all WB jobs?<br><strong>A:</strong> No, specifics vary by department and post.</p>
  <p><strong>Q3:</strong> How do I track updates?<br><strong>A:</strong> Follow the official portal and reliable news/job feeds.</p>
  <p class="badge">Disclaimer: Always verify on the official website.</p>
  `;
}

// --- AI generation (4.5k–6k words target) ---
async function aiGenerateLong(text, title, srcUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { html: buildLongFallback(title, '', text, srcUrl), usedAI: false };
  }

  const sys = `You are an expert editor for a West Bengal jobs website. Write a comprehensive, original, well-structured article for job seekers.
- STYLE: clear, neutral, practical.
- LENGTH: 4,500–6,000 words (aim high but keep useful).
- STRUCTURE: Use H2/H3, bullets, tables where useful. Cover: Overview; Key Dates; Vacancy & Eligibility; Reservation & Age Relaxation; Selection Process & Syllabus; How to Apply (step-by-step); Documents Required; Application Fees; Salary/Pay Level; Important Links (plain text); FAQs (8–12 items); Tips.
- FACTS: Do not invent numbers. If a detail is uncertain, write "Check official notice".
- END with: "Always verify on the official website."`;

  const user = `TITLE: ${title || 'N/A'}
SOURCE URL: ${srcUrl || 'N/A'}
SOURCE TEXT (trimmed to 12k chars):
${text.slice(0, 12000)}

TASK: Write the full article in valid HTML fragments (NO <html> or <body>).`;

  // 1) Main long pass
  const r1 = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.4
    })
  });

  if (!r1.ok) {
    // Handle quota/other errors gracefully
    try {
      const err = await r1.json();
      if (err?.error?.code === 'insufficient_quota') {
        return { html: buildLongFallback(title, '', text, srcUrl), usedAI: false };
      }
      const msg = err?.error?.message || 'AI error';
      return { html: buildLongFallback(title, `AI error: ${msg}`, text, srcUrl), usedAI: false };
    } catch {
      return { html: buildLongFallback(title, 'AI request failed.', text, srcUrl), usedAI: false };
    }
  }

  const j1 = await r1.json();
  let html = (j1.choices?.[0]?.message?.content || '').trim();
  if (!html) return { html: buildLongFallback(title, 'AI returned empty content.', text, srcUrl), usedAI: false };

  // If still short, do a lightweight "continue" prompt once
  const wordCount = html.split(/\s+/).length;
  if (wordCount < 4200) {
    const r2 = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role:'system', content: sys },
          { role:'user', content: `Continue and extend the previous article. Add depth in each section and an expanded FAQ, without repeating content. Return HTML fragments only.` }
        ],
        temperature: 0.4
      })
    });
    if (r2.ok) {
      const j2 = await r2.json();
      const more = (j2.choices?.[0]?.message?.content || '').trim();
      if (more) html += `\n\n${more}`;
    }
  }

  return { html, usedAI: true };
}

// --- Fetch page & orchestrate ---
async function fetchPage(url) {
  const res = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0 (JobPulse-AI/1.0)' } });
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const html = await res.text();
  return html;
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');
    if (qs.get('selftest') === '1') {
      return reply(200, { ok: true, openai_key_present: !!process.env.OPENAI_API_KEY });
    }

    // Accept text mode fallback
    const textParam = qs.get('text');
    const titleParam = qs.get('title') || '';
    if (textParam && textParam.trim().length > 30) {
      const { html } = await aiGenerateLong(textParam.trim(), titleParam, null);
      return reply(200, { html, images: [] });
    }

    const rawLink = qs.get('link');
    const link = normalizeUrl(rawLink);
    if (!link) {
      return reply(400, { html: '<p class="notice">Invalid or missing link.</p>', images: [] });
    }

    // Pull page HTML, extract text + images
    const pageHTML = await fetchPage(link);
    const images = extractImages(pageHTML, link, 8);
    const text = htmlToText(pageHTML);

    // Generate long article (AI if possible; fallback if not)
    const out = await aiGenerateLong(text, qs.get('title') || '', link);

    return reply(200, {
      html: out.html,
      images,                  // ONLY article images, no AI images
      usedAI: out.usedAI === true
    });
  } catch (e) {
    return reply(200, { html: `<p class="notice">Error: ${e.message}</p>`, images: [] });
  }
};
