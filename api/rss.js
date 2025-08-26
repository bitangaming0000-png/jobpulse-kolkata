const fs = require('fs');
const path = require('path');

const WB_RE = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\b/i;

function strip(s=''){ return String(s).replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); }
function getTag(xml, tag){ const re=new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'); const m=xml.match(re); return m?m[1].trim():''; }
function parseItems(xml){
  const items=[]; const re=/<item\b[\s\S]*?<\/item>/gi; let m;
  while((m=re.exec(xml))!==null){ const b=m[0]; items.push({title:strip(getTag(b,'title')),link:strip(getTag(b,'link')),description:strip(getTag(b,'description')),pubDate:strip(getTag(b,'pubDate'))}); }
  // Atom fallback
  if(!items.length){
    const reA=/<entry\b[\s\S]*?<\/entry>/gi; let ma;
    while((ma=reA.exec(xml))!==null){
      const b=ma[0];
      const lm=b.match(/<link[^>]*href="([^"]+)"/i);
      items.push({
        title:strip(getTag(b,'title')),
        link: lm?lm[1]:strip(getTag(b,'id')),
        description: strip(getTag(b,'summary'))||strip(getTag(b,'content')),
        pubDate: strip(getTag(b,'updated'))||strip(getTag(b,'published'))
      });
    }
  }
  return items;
}
function isWB({title='',description='',link=''}){ return WB_RE.test(`${title} ${description} ${link}`); }

function readFeedsConfig(){
  let p = path.join(process.cwd(),'data','feeds.json');
  if (!fs.existsSync(p)) { p = path.join(process.cwd(),'public','data','feeds.json'); }
  const raw = fs.readFileSync(p,'utf8');
  const j = JSON.parse(raw);
  return Array.isArray(j)?j:(j.sources||[]);
}

module.exports = async (req,res)=>{
  try{
    const feeds=readFeedsConfig();
    if(!feeds.length) throw new Error('No feeds in data/feeds.json');

    const results = await Promise.allSettled(feeds.map(async f=>{
      const r = await fetch(f.url,{headers:{'user-agent':'jobpulse-rss-bot'}});
      const xml = await r.text();
      return parseItems(xml).map(x=>({...x,_category:f.category||'news',_source:f.url}));
    }));
    let all=[]; for(const r of results) if(r.status==='fulfilled') all=all.concat(r.value);

    const seen=new Set(); const filtered=[];
    for(const it of all){ if(!it.link) continue; if(!isWB(it)) continue; if(seen.has(it.link)) continue; seen.add(it.link); filtered.push(it); }

    filtered.sort((a,b)=>{ const da=Date.parse(a.pubDate||'')||0, db=Date.parse(b.pubDate||'')||0; if(db!==da) return db-da; return (b.title||'').localeCompare(a.title||''); });

    res.setHeader('Cache-Control','public, max-age=300');
    return res.status(200).json({ok:true,count:filtered.length,items:filtered.slice(0,200)});
  }catch(e){ return res.status(500).json({ok:false,error:e.message}); }
};
