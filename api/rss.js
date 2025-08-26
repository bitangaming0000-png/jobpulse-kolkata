// api/rss.js
// Merge multiple RSS/Atom feeds listed in /data/feeds.json, filter to WB items, return JSON.

const fs = require('fs');
const path = require('path');

const WB_RE = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\b/i;

function strip(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}
function parseItems(xml) {
  const items = [];
  // RSS <item>
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const title = strip(getTag(block, 'title'));
    const link  = strip(getTag(block, 'link'));
    const desc  = strip(getTag(block, 'description'));
    const pub   = strip(getTag(block, 'pubDate'));
    items.push({ title, link, description: desc, pubDate: pub });
  }
  // Atom <entry>
  if (!items.length) {
    const reA = /<entry\b[\s\S]*?<\/entry>/gi; let ma;
    while ((ma = reA.exec(xml)) !== null) {
      const block = ma[0];
      const title = strip(getTag(block, 'title'));
      const lm = block.match(/<link[^>]*href="([^"]+)"/i);
      const link = lm ? lm[1] : strip(getTag(block, 'id'));
      const desc = strip(getTag(block, 'summary')) || strip(getTag(block, 'content'));
      const pub  = strip(getTag(block, 'updated')) || strip(getTag(block, 'published'));
      items.push({ title, link, description: desc, pubDate: pub });
    }
  }
  return items;
}
function isWB({ title = '', description = '', link = '' }) {
  return WB_RE.test(`${title} ${description} ${link}`);
}

function readFeedsConfig() {
  const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
  const raw = fs.readFileSync(feedsPath, 'utf8');
  const j = JSON.parse(raw);
  return Array.isArray(j) ? j : (j.sources || []);
}

module.exports = async (req, res) => {
  try {
    const feeds = readFeedsConfig();
    if (!feeds || !feeds.length) throw new Error('No feeds in data/feeds.json');

    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        const r = await fetch(f.url, { headers: { 'user-agent': 'jobpulse-rss-bot' } });
        const xml = await r.text();
        const items = parseItems(xml).map(x => ({
          ...x,
          _category: f.category || 'news',
          _source: f.url
        }));
        return items;
      })
    );

    let all = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all = all.concat(r.value);
    }

    // WB filter + dedupe
    const seen = new Set();
    const filtered = [];
    for (const it of all) {
      if (!it.link) continue;
      if (!isWB(it)) continue;
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      filtered.push(it);
    }

    filtered.sort((a, b) => {
      const da = Date.parse(a.pubDate || '') || 0;
      const db = Date.parse(b.pubDate || '') || 0;
      if (db !== da) return db - da;
      return (b.title || '').localeCompare(a.title || '');
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ ok: true, count: filtered.length, items: filtered.slice(0, 200) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
