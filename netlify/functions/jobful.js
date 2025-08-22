const Parser = require("rss-parser");
const parser = new Parser({
  customFields: { item: [
    ["media:content","media",{keepArray:true}],
    ["media:thumbnail","thumbnail"],
    ["image","image"],
    ["content:encoded","contentEncoded"]
  ] }
});
const { scrapeList } = require("./scrapeWB");
const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join("/tmp","jobful-cache.json");
const CACHE_TTL  = 15 * 60 * 1000; // 15 minutes
const SOURCES_FILE = path.join(__dirname,"sources.json");

const BUILTIN = {
  remotive: { enabled:true, mode:"rss", type:"job",  name:"Remotive",               url:"https://remotive.com/feed",                                region:"GLOBAL" },
  wwr:      { enabled:true, mode:"rss", type:"job",  name:"We Work Remotely",       url:"https://weworkremotely.com/remote-jobs.rss",               region:"GLOBAL" },
  highered: { enabled:true, mode:"rss", type:"job",  name:"HigherEdJobs",           url:"https://www.higheredjobs.com/rss/",                        region:"GLOBAL" },
  ucr:      { enabled:true, mode:"rss", type:"news", name:"Undercover Recruiter",   url:"https://theundercoverrecruiter.com/feed",                  region:"GLOBAL" },
  acara:    { enabled:true, mode:"rss", type:"news", name:"Acara Solutions (Blog)", url:"https://acarasolutions.com/blog/category/job-seeker/feed", region:"GLOBAL" }
};

const EXAM_KEYS = /(exam|admit card|hall ticket|result|answer key|syllabus|cut ?off|merit list|notification)/i;

function readUserSources(){
  try{
    if (fs.existsSync(SOURCES_FILE)){
      const raw = fs.readFileSync(SOURCES_FILE,"utf8");
      const json = JSON.parse(raw);
      return json && typeof json === "object" ? json : {};
    }
  }catch(e){ console.error("sources.json read error:", e.message); }
  return {};
}
function mergeSources(){
  const user = readUserSources();
  const merged = { ...BUILTIN, ...user };
  const out = {};
  for (const [k, s] of Object.entries(merged)){
    if (!s || s.enabled !== true) continue;
    if (!s.url || !s.type || !s.name) continue;
    if (!s.mode) s.mode = "rss";
    out[k] = s;
  }
  return out;
}

function extractImage(item){
  if (item?.enclosure?.url) return item.enclosure.url;
  if (item?.media && item.media[0]?.$?.url) return item.media[0].$?.url;
  if (item?.thumbnail) return item.thumbnail.url || item.thumbnail;
  if (item?.image) return item.image.url || item.image;
  const html = item?.contentEncoded || item?.content || "";
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchRSS(key, src){
  const feed = await parser.parseURL(src.url);
  return (feed.items || []).map((it, i)=>({
    id: it.guid || it.link || `${src.url}#${i}`,
    title: it.title || "Untitled",
    link: it.link || "",
    description: it.contentSnippet || it.contentEncoded || it.content || "",
    pubDate: it.pubDate || new Date().toISOString(),
    thumbnail: extractImage(it),
    category: src.type === "job" ? "Job" : "News",
    source: src.name,
    sourceKey: key,
    region: src.region || null
  }));
}

async function fetchSCRAPE(key, src){
  const items = await scrapeList({
    url: src.url,
    itemSelector: src.itemSelector,
    titleSelector: src.titleSelector,
    linkSelector: src.linkSelector,
    dateSelector: src.dateSelector,
    base: src.base || src.url,
    type: src.type,
    name: src.name,
    region: src.region
  });
  return items.map(o => ({ ...o, sourceKey: key, category: src.type === "job" ? "Job" : "News" }));
}

async function buildAll(SOURCES){
  let jobs=[], news=[], exams=[];
  for (const [key, src] of Object.entries(SOURCES)){
    try{
      const arr = (src.mode === "scrape") ? await fetchSCRAPE(key, src) : await fetchRSS(key, src);
      if (src.type === "job") jobs.push(...arr); else news.push(...arr);
      arr.forEach(p=>{
        const hay=(p.title||"")+" "+(p.description||"");
        if (EXAM_KEYS.test(hay)) exams.push(p);
      });
    }catch(e){ console.error("Feed error:", key, e.message); }
  }
  jobs.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  news.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  exams.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  return { jobs, news, exams };
}

exports.handler = async (event) => {
  try{
    const { source, type, region } = event.queryStringParameters || {};
    const SOURCES = mergeSources();

    if (fs.existsSync(CACHE_FILE)) {
      const age = Date.now() - fs.statSync(CACHE_FILE).mtimeMs;
      if (age < CACHE_TTL) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        return route(cached, { source, type, region, SOURCES });
      }
    }

    const data = await buildAll(SOURCES);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
    return route(data, { source, type, region, SOURCES });

  }catch(err){
    console.error("Global error:", err);
    if (fs.existsSync(CACHE_FILE)) {
      const cached = fs.readFileSync(CACHE_FILE, "utf8");
      return ok(JSON.parse(cached));
    }
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function route(payload, { source, type, region, SOURCES }){
  if (source && SOURCES[source]) {
    const bucket = SOURCES[source].type === "job" ? "jobs" : "news";
    return ok(filterRegion(payload[bucket].filter(i=>i.sourceKey===source), region));
  }
  if (type === "jobs")  return ok(filterRegion(payload.jobs, region));
  if (type === "news")  return ok(filterRegion(payload.news, region));
  if (type === "exams") return ok(filterRegion(payload.exams, region));
  return ok({
    jobs:  filterRegion(payload.jobs, region),
    news:  filterRegion(payload.news, region),
    exams: filterRegion(payload.exams, region)
  });
}

function filterRegion(items, region){
  if (!region) return items;
  const R = String(region).toLowerCase();
  return (items||[]).filter(i => (i.region||"").toLowerCase() === R);
}
function ok(body){ return { statusCode: 200, headers: cors(), body: JSON.stringify(body) }; }
function cors(){ return { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*", "Cache-Control":"public, max-age=60" }; }
