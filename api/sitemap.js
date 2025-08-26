// netlify/functions/sitemap.js
const fetchFn = global.fetch;

function xmlEscape(s=''){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

module.exports.handler = async () => {
  try {
    const host = process.env.URL || 'https://jobpulse-kolkata.netlify.app';

    // fetch your RSS aggregator endpoint
    const rr = await fetchFn(`${host}/api/rss`, { headers: { 'user-agent':'jobpulse-sitemap-bot' } });
    if(!rr.ok) throw new Error(`RSS fetch failed: ${rr.status}`);
    const data = await rr.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // static pages
    const urls = [
      `${host}/`,
      `${host}/pages/saved.html`,
      `${host}/pages/privacy.html`
    ];

    // dynamic posts (cap to 500)
    for(const it of items.slice(0,500)){
      const loc = `${host}/pages/post.html?title=${encodeURIComponent(it.title||'')}&link=${encodeURIComponent(it.link||'')}`;
      urls.push(loc);
    }

    const today = new Date().toISOString().slice(0,10);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${xmlEscape(u)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600'
      },
      body: xml
    };
  } catch (e) {
    return { statusCode: 500, headers: {'Content-Type':'text/plain'}, body: 'Error generating sitemap: ' + e.message };
  }
};
