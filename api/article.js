// api/article.js
// Fetches the source URL and returns a SAFE, modest-length HTML excerpt.
// We avoid copying full articles to respect copyright; we provide a fair-use style summary.

function stripTags(html=''){
  return html.replace(/<script[\s\S]*?<\/script>/gi,'')
             .replace(/<style[\s\S]*?<\/style>/gi,'')
             .replace(/<!--[\s\S]*?-->/g,'')
             .replace(/\s+/g,' ');
}

function extractParagraphs(html){
  // Prefer <article> content
  const artMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let body = artMatch ? artMatch[1] : html;

  // Collect paragraph texts
  const paras = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m; let chars=0;
  while((m = re.exec(body)) !== null){
    const t = m[1].replace(/<[^>]+>/g,'').trim();
    if(!t) continue;
    paras.push(t);
    chars += t.length;
    if(chars > 2500) break; // modest excerpt ~ 300-500 words depending on average length
  }
  return paras;
}

function toSafeHtml(paras){
  // Build simple, safe HTML from text only
  const items = paras.slice(0,12).map(p => `<p>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`);
  // Add “Key points” list if long enough
  if(paras.length >= 6){
    const bullets = paras.slice(0,6).map(p => p.split('. ')[0]).slice(0,5);
    items.unshift('<h2>Key Points</h2><ul>'+bullets.map(b=>`<li>${b.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('')+'</ul>');
  }
  return items.join('\n');
}

module.exports = async (req, res) => {
  try{
    const url = (req.query?.url || req.url?.split('?url=')[1] || '').trim();
    if(!url) return res.status(400).json({ok:false,error:'Missing url'});
    // Basic validation
    let u;
    try{ u = new URL(url); }catch{ return res.status(400).json({ok:false,error:'Invalid URL'}); }

    const r = await fetch(u.toString(), { headers: { 'user-agent': 'jobpulse-article-bot' } });
    const html = await r.text();
    const clean = stripTags(html);
    const paras = extractParagraphs(clean);

    // Safe, shortish HTML (not the full article)
    const contentHtml = toSafeHtml(paras);

    res.setHeader('Cache-Control','public, max-age=180');
    return res.status(200).json({ ok:true, contentHtml });
  }catch(e){
    return res.status(200).json({ ok:true, contentHtml: `<p>Full details are available at the source link above.</p>` });
  }
};
