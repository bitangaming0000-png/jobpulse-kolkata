// api/sitemap.js
// Dynamic sitemap = static pages + the latest WB posts from /api/rss

function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function asISO(d) {
  const t = Date.parse(d || "");
  return isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

module.exports = async (req, res) => {
  try {
    const base = `https://${req.headers.host}`;

    // 1) Static pages (edit if you add more)
    const staticUrls = [
      { loc: `${base}/`, changefreq: "hourly", priority: 0.8, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/post.html`, changefreq: "weekly", priority: 0.6, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/privacy.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/terms.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/disclaimer.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/contact.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() }
    ];

    // 2) Pull latest posts from your own API
    let dynamicUrls = [];
    try {
      const r = await fetch(`${base}/api/rss`, { headers: { "user-agent": "jobpulse-sitemap-bot" }, cache: "no-store" });
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items.slice(0, 200) : [];

      dynamicUrls = items.map(it => {
        // Build the exact post page URL your site uses (with query params)
        const u = new URL(`${base}/pages/post.html`);
        if (it.title) u.searchParams.set("title", it.title);
        if (it.link)  u.searchParams.set("link",  it.link);
        if (it.description) u.searchParams.set("desc", it.description);
        if (it.pubDate)     u.searchParams.set("date", it.pubDate);

        return {
          loc: u.toString(),
          changefreq: "daily",
          priority: 0.55,
          lastmod: asISO(it.pubDate)
        };
      });
    } catch (_) {
      // If RSS fails, keep only static URLs
      dynamicUrls = [];
    }

    const all = [...staticUrls, ...dynamicUrls];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      all.map(u => {
        const loc = xmlEscape(u.loc);
        const lm  = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "";
        return `  <url>\n    <loc>${loc}</loc>\n    ${lm}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
      }).join("\n") +
      `\n</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600"); // 10 min
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send("Error generating sitemap: " + e.message);
  }
};
