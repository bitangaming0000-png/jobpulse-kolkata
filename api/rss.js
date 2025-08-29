// api/rss.js
import Parser from "rss-parser";
import feeds from "../data/feeds.json" assert { type: "json" };

const parser = new Parser();

// Keywords to keep only West Bengal / Kolkata relevant jobs
const WB_KEYWORDS = ["west bengal","kolkata","wbpsc","kmc","siliguri","howrah","durga","hooghly","wb govt"];

function isWestBengal(item) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  return WB_KEYWORDS.some(k => text.includes(k));
}

export default async function handler(req, res) {
  try {
    const items = [];
    const urls = feeds.feeds; // all feeds from JSON

    const results = await Promise.allSettled(
      urls.map(url => parser.parseURL(url))
    );

    results.forEach(r => {
      if (r.status === "fulfilled" && r.value?.items) {
        r.value.items.forEach(it => {
          items.push({
            title: it.title || "",
            link: it.link || "",
            description: it.contentSnippet || it.content || "",
            pubDate: it.pubDate || new Date().toUTCString()
          });
        });
      }
    });

    // Filter for West Bengal jobs only
    const wbItems = items.filter(isWestBengal);

    // Sort latest first
    wbItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.status(200).json({ items: wbItems.slice(0, 500) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
