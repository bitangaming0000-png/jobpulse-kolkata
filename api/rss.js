// api/rss.js
import Parser from "rss-parser";
import feeds from "../data/feeds.json" assert { type: "json" };

const parser = new Parser();

export default async function handler(req, res) {
  try {
    const items = [];
    const maxFeeds = 30; // don’t overload Vercel at once
    const urls = feeds.feeds.slice(0, maxFeeds);

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

    // sort latest first
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.status(200).json({ items: items.slice(0, 500) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
