// netlify/functions/fetchFeeds.js
const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media", { keepArray: true }],
      ["media:thumbnail", "thumbnail"],
      ["image", "image"],
      ["content:encoded", "contentEncoded"]
    ],
  },
});

const fs = require("fs");
const path = require("path");
const CACHE_FILE = path.join("/tmp", "feeds-lite.json");
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Start with two reliable feeds; we can add more later
const feeds = [
  { name: "Remotive Jobs", url: "https://remotive.com/feed", type: "job" },
  { name: "We Work Remotely", url: "https://weworkremotely.com/remote-jobs.rss", type: "job" }
];

function extractImage(item){
  if (item.enclosure?.url) return item.enclosure.url;
  if (item.media && item.media[0]?.$?.url) return item.media[0].$?.url;
  if (item.thumbnail) return item.thumbnail.url || item.thumbnail;
  if (item.image) return item.image.url || item.image;
  const html = item.contentEncoded || item.content || "";
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchAll(){
  let jobs = [], news = [];
  for (const f of feeds) {
    try {
      const parsed = await parser.parseURL(f.url);
      const items = (parsed.items || []).map((it, i) => ({
        id: it.guid || it.link || `${f.url}#${i}`,
        title: it.title || "Untitled",
        link: it.link || "",
        description: it.contentSnippet || it.contentEncoded || it.content || "",
        pubDate: it.pubDate || new Date().toISOString(),
        thumbnail: extractImage(it),
        category: f.type === "job" ? "Job" : "News",
        source: f.name
      }));
      if (f.type === "job") jobs.push(...items); else news.push(...items);
    } catch (e) {
      console.error("Feed error:", f.url, e.message);
    }
  }
  jobs.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  news.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  return { jobs, news };
}

exports.handler = async () => {
  try {
    // Serve cache if fresh
    if (fs.existsSync(CACHE_FILE)) {
      const age = Date.now() - fs.statSync(CACHE_FILE).mtimeMs;
      if (age < CACHE_TTL) {
        const cached = fs.readFileSync(CACHE_FILE, "utf8");
        return { statusCode: 200, body: cached, headers: { "Content-Type": "application/json" } };
      }
    }
    // Fetch fresh
    const data = await fetchAll();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
    return { statusCode: 200, body: JSON.stringify(data), headers: { "Content-Type": "application/json" } };
  } catch (err) {
    console.error("Global error:", err);
    if (fs.existsSync(CACHE_FILE)) {
      const cached = fs.readFileSync(CACHE_FILE, "utf8");
      return { statusCode: 200, body: cached, headers: { "Content-Type": "application/json" } };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
