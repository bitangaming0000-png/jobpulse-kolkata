const cheerio = require("cheerio");
function abs(base, href){ try { return new URL(href, base).toString(); } catch { return href || base; } }
function parseDate(txt){ if(!txt) return new Date().toISOString(); const d=new Date(txt); return isNaN(d.getTime())? new Date().toISOString() : d.toISOString(); }
async function scrapeList(cfg){
  const { url, itemSelector, titleSelector, linkSelector, dateSelector, base, type, name, region } = cfg;
  const res = await fetch(url, { headers: { "User-Agent": "JobPulseBot/1.0 (+https://jobpulse-kolkata.netlify.app)" }});
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];
  $(itemSelector).each((i, el)=>{
    const $el=$(el); const $title=titleSelector? $el.find(titleSelector).first() : $el.find("a").first();
    const title = ($title.text()||"").trim();
    let href=""; if (linkSelector){ const $a=$el.find(linkSelector).first(); href=$a.attr("href")||""; } else { href=$title.attr("href")||$el.find("a").first().attr("href")||""; }
    const link=abs(base||url, href);
    const dateTxt=dateSelector? ($el.find(dateSelector).first().text()||"").trim() : "";
    const pubDate=parseDate(dateTxt);
    if (title && link){
      items.push({ id:`${link}`, title, link, description:"", pubDate, thumbnail:"", category: type==="job"?"Job":"News", source:name, sourceKey: name.toLowerCase().replace(/\s+/g,"_"), region: region||null });
    }
  });
  return items;
}
module.exports = { scrapeList };
