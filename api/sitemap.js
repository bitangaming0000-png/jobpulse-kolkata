module.exports = async (req, res) => {
  const base = 'https://jobpulse-kolkata.vercel.app';
  const urls = [
    '/',
    '/pages/post.html',
    '/pages/privacy.html',
    '/pages/terms.html',
    '/pages/disclaimer.html',
    '/pages/contact.html'
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `
  <url>
    <loc>${base}${u}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.status(200).send(xml);
};
