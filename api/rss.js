const fs = require('fs');
const path = require('path');

const WB_RE = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\b/i;

function strip(s=''){ return String(s).replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); }
function getTag(xml, tag){ const re=new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'); const m=xml.match(re); return m?m[1].trim():''; }
function parseItems(xml){
  const items=[]; const re=/<item\b[\s\S]*?<\/item>/gi; let m;
  while((m=re.exec(xml))!==null){ const b=m[0]; items.push({title:strip(getTag(b,'title')),link:strip(getTag(b,'link')),description:strip(getTag(b,'description')),pubDate:strip(getTag(b,'pubDate'))}); }
  return items;
}
function isWB({title='',description='',link=''}){ return WB_RE.test(`${title} ${description} ${link}`); }

function readFeedsConfig(){
  let p = path.join(process.cwd(),'data','feeds.json');
  const raw = fs.readFileSync(p,'utf8');
  const j = JSON.parse(raw);
  return Array.isArray(j)?j:(j.sources||[]);
}

module.exports = async (req,res)=>{
  try{
    const feeds=readFeedsConfig();
    const results = await Promise.allSettled(feeds.map(async f=>{
      const r = await fetch(f.url,{headers:{'user-agent':'jobpulse-rss-bot'}});
      const xml = await r.text();
      return parseItems(xml).map(x=>({...x,_category:f.category||'news'}));
    }));
    let all=[]; for(const r of results) if(r.status==='fulfilled') all=all.concat(r.value);
    const seen=new Set(); const filtered=[];
    for(const it of all){ if(!it.link) continue; if(!isWB(it)) continue; if(seen.has(it.link)) continue; seen.add(it.link); filtered.push(it); }
    res.setHeader('Cache-Control','public,max-age=300');
    return res.status(200).json({ok:true,count:filtered.length,items:filtered.slice(0,200)});
  }catch(e){ return res.status(500).json({ok:false,error:e.message}); }
};
