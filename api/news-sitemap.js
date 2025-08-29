// api/news-sitemap.js
// Google News sitemap: only last 48 hours of items

function xmlEscape(s=""){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function within48h(dateStr){
  const t = Date.parse(dateStr||""); if(Number.isNaN(t)) return false;
  return (Date.now() - t) <= 48*60*60*1000;
}

module.exports = async (req,res)=>{
  try{
    const base = `https://${req.headers.host}`;
    const r = await fetch(`${base}/api/rss`, { headers:{'user-agent':'jobpulse-news-sitemap'}, cache:'no-store' });
    const j = await r.json();
    let items = Array.isArray(j.items) ? j.items.filter(it=>within48h(it.pubDate)).slice(0,100) : [];

    const publicationName = "JobPulse Kolkata";
    const lang = "en";

    const ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"';
    const xmlHead = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns}>\n`;
    const xmlTail = `\n</urlset>`;

    const body = items.map(it=>{
      const url = new URL(`${base}/pages/post.html`);
      if(it.title) url.searchParams.set('title', it.title);
      if(it.link)  url.searchParams.set('link', it.link);
      if(it.description) url.searchParams.set('desc', it.description);
      if(it.pubDate)     url.searchParams.set('date', it.pubDate);

      return `  <url>
    <loc>${xmlEscape(url.toString())}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(publicationName)}</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${new Date(it.pubDate || Date.now()).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(it.title || 'WB Job Update')}</news:title>
    </news:news>
  </url>`;
    }).join("\n");

    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=600');
    res.status(200).send(xmlHead + body + xmlTail);
  }catch(e){
    res.status(500).send("Error generating news sitemap: "+e.message);
  }
};
