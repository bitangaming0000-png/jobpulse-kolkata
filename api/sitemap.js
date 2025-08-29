// api/sitemap.js
// Builds a dynamic sitemap: static pages + latest items from /api/rss
// Works on Vercel; no extra config needed.

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

    // 1) Static routes (edit if you add more pages)
    const staticUrls = [
      { loc: `${base}/`, changefreq: "hourly", priority: 0.8, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/post.html`, changefreq: "weekly", priority: 0.6, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/privacy.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/terms.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/disclaimer.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() },
      { loc: `${base}/pages/contact.html`, changefreq: "yearly", priority: 0.3, lastmod: new Date().toISOString() }
    ];

    // 2) Dynamic posts from your own API (WB-only items)
    let dynamicUrls = [];
    try {
      const rssUrl = `${base}/api/rss`;
      const r = await fetch(rssUrl, { headers: { "user-agent": "jobpulse-sitemap-bot" } });
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items.slice(0, 120) : []; // cap to 120 most-recent

      dynamicUrls = items.map(it => {
        // Build the same post.html link your site uses (with query params)
        const url = new URL(`${base}/pages/post.html`);
        url.searchParams.set("title", it.title || "");
        url.searchParams.set("link", it.link || "");
        if (it.description) url.searchParams.set("desc", it.description);
        if (it.pubDate) url.searchParams.set("date", it.pubDate);

        return {
          loc: url.toString(),
          changefreq: "daily",
          priority: 0.55,
          lastmod: asISO(it.pubDate)
        };
      });
    } catch (_) {
      // If /api/rss fails we still return static sitemap (no crash)
      dynamicUrls = [];
    }

    const allUrls = [...staticUrls, ...dynamicUrls];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      allUrls
        .map(u => {
          const locEsc = xmlEscape(u.loc);
          const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "";
          return `  <url>\n    <loc>${locEsc}</loc>\n    ${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
        })
        .join("\n") +
      `\n</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600"); // 10 minutes
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send("Error generating dynamic sitemap: " + e.message);
  }
};
