export async function handler() {
  try {
    // Fetch your latest RSS items (same as homepage does)
    const r = await fetch(`${process.env.URL || 'https://jobpulse-kolkata.netlify.app'}/api/rss`);
    const j = await r.json();
    const items = j.items || [];

    const host = process.env.URL || 'https://jobpulse-kolkata.netlify.app';

    // Static pages
    const urls = [
      `${host}/`,
      `${host}/pages/saved.html`,
      `${host}/pages/privacy.html`
    ];

    // Dynamic job posts
    for (const it of items.slice(0, 200)) {  // limit to 200 for size
      urls.push(
        `${host}/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}`
      );
    }

    // Build sitemap XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml" },
      body: xml
    };
  } catch (e) {
    return { statusCode: 500, body: "Error generating sitemap: " + e.message };
  }
}
