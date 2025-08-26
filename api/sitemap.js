// api/sitemap.js
// Dynamic sitemap using the same /api/rss endpoint.

function xmlEscape(s = '') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

module.exports = async (req, res) => {
  try {
    const host = `https://${req.headers.host}`;
    const rr = await fetch(`${host}/api/rss`, { headers: { 'user-agent':'jobpulse-sitemap-bot' } });
    if (!rr.ok) throw new Error(`RSS fetch failed: ${rr.status}`);
    const data = await rr.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const urls = [
      `${host}/`,
      `${host}/pages/saved.html`,
      `${host}/pages/privacy.html`,
      `${host}/pages/about.html`,
      `${host}/pages/terms.html`,
      `${host}/pages/disclaimer.html`,
      `${host}/pages/contact.html`
    ];

    for (const it of items.slice(0, 500)) {
      urls.push(`${host}/pages/post.html?title=${encodeURIComponent(it.title || '')}&link=${encodeURIComponent(it.link || '')}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${xmlEscape(u)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).send(xml);
  } catch (e) {
    return res.status(500).send('Error generating sitemap: ' + e.message);
  }
};
