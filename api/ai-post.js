// api/ai-post.js
// Fetches the source page, extracts visible text, produces a structured HTML article.
// No paid APIs. It's a heuristic, but works well for long-form content.

function cleanHTML(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');
}
function stripTags(h = '') {
  return h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function section(title, body) {
  return `<h2>${title}</h2><p>${body}</p>`;
}

module.exports = async (req, res) => {
  try {
    const link = (req.query.link || '').toString();
    if (!link || !/^https?:\/\//i.test(link)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing "link" param' });
    }

    const r = await fetch(link, { headers: { 'user-agent': 'jobpulse-article-bot' } });
    const htmlRaw = await r.text();
    const html = cleanHTML(htmlRaw);

    // naive extraction: take main/article/body text chunks
    const mainMatch = html.match(/<(main|article|body)[^>]*>([\s\S]*?)<\/\1>/i);
    const core = mainMatch ? mainMatch[2] : html;
    const text = stripTags(core);

    // Build sections
    const words = text.split(/\s+/).filter(Boolean);
    const trimmed = words.slice(0, 3000).join(' '); // cap

    // simple bullets
    const lower = trimmed.toLowerCase();
    const bullets = [];
    const add = (s) => { if (s && !bullets.includes(s)) bullets.push(s); };
    if (lower.includes('eligib')) add('Check age, education, and category relaxations in the official notification.');
    if (lower.includes('apply')) add('Apply through the official portal; keep scanned documents ready.');
    if (lower.includes('fee')) add('Application fee may apply; verify amount and payment method.');
    if (lower.includes('exam')) add('Note the exam pattern, syllabus, and admit card release date.');
    if (!bullets.length) bullets.push('Read the official notification carefully before applying.');

    const htmlOut = `
      <p><strong>Summary:</strong> ${trimmed.slice(0, 600)}...</p>
      ${section('Overview', 'This post summarizes the official update in a readable format for West Bengal candidates.')}
      ${section('Eligibility', 'Eligibility varies by department/post. Review the official PDF for exact details (age, education, experience).')}
      <h2>Important Points</h2>
      <ul>${bullets.map(b=>`<li>${b}</li>`).join('')}</ul>
      ${section('Important Dates', 'Refer to the official website/notification for application start/end dates and exam schedule.')}
      ${section('How to Apply', 'Visit the official link, register or log in, complete the form, upload documents, and submit. Save the acknowledgement.')}
      <p><em>Source:</em> <a href="${link}" target="_blank" rel="noopener">${link}</a></p>
    `.replace(/\n\s+/g,'\n');

    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(200).json({ ok: true, html: htmlOut });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
