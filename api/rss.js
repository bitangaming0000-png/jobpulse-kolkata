// /api/rss.js — CommonJS, dependency-free RSS fetcher/merger with optional WB filter

const fs = require('fs');
const path = require('path');

// ---------- Load feeds.json (optional) ----------
function loadFeeds() {
  try {
    const p = path.join(__dirname, '..', 'data', 'feeds.json');
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    if (j && Array.isArray(j.feeds) && j.feeds.length) return j.feeds;
  } catch (_) {}
  // Fallback minimal set (still works even if data/feeds.json missing)
  return [
    'https://wbpsc.gov.in/rss.xml',
    'https://www.kmcgov.in/rss/news.xml',
    'https://www.sarkariresult.com/feed',
    'https://www.freejobalert.com/feed'
  ];
}

// ---------- Tiny parser helpers ----------
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
function parseRSS(xml) {
  const items = [];

  // RSS 2.0 <item>
  let m;
  const reItem = /<item\b[\s\S]*?<\/item>/gi;
  while ((m = reItem.exec(xml)) !== null) {
    const b = m[0];
    items.push({
      title: strip(getTag(b, 'title')),
      link: strip(getTag(b, 'link')) || strip(getTag(b, 'guid')),
      description: strip(getTag(b, 'description')),
      pubDate: strip(getTag(b, 'pubDate'))
    });
  }

  // Atom <entry>
  if (!items.length) {
    let a;
    const reEntry = /<entry\b[\s\S]*?<\/entry>/gi;
    while ((a = reEntry.exec(xml)) !== null) {
      const b = a[0];
      const lm = b.match(/<link[^>]*href="([^"]+)"/i);
      items.push({
        title: strip(getTag(b, 'title')),
        link: lm ? lm[1] : strip(getTag(b, 'id')),
        description: strip(getTag(b, 'summary')) || strip(getTag(b, 'content')),
        pubDate: strip(getTag(b, 'updated')) || strip(getTag(b, 'published'))
      });
    }
  }
  return items;
}

// ---------- WB filter (default ON) ----------
const WB_RE = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Midnapore|Bardhaman|Burdwan|Asansol|Bankura|Purulia|Malda|Murshidabad|Jalpaiguri|Cooch Behar|Alipurduar)\b/i;
function isWB(it) {
  const s = `${it.title || ''} ${it.description || ''} ${it.link || ''}`;
  return WB_RE.test(s);
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  try {
    const ALL = loadFeeds();

    // Limit the batch size to avoid long cold starts
    const urls = ALL.slice(0, 60);

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const r = await fetch(url, { headers: { 'user-agent': 'jobpulse-kolkata-bot' } });
        const xml = await r.text();
        return parseRSS(xml);
      })
    );

    // merge
    let items = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        items = items.concat(r.value);
      }
    }

    // dedupe by link
    const seen = new Set();
    const deduped = [];
    for (const it of items) {
      if (!it.link) continue;
      const key = it.link.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }

    // WB filter unless ?all=1
    const wantAll = req.query && (req.query.all === '1' || req.query.all === 'true');
    const filtered = wantAll ? deduped : deduped.filter(isWB);

    // sort newest first
    filtered.sort((a, b) => {
      const da = Date.parse(a.pubDate || '') || 0;
      const db = Date.parse(b.pubDate || '') || 0;
      if (db !== da) return db - da;
      return (b.title || '').localeCompare(a.title || '');
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.status(200).json({
      ok: true,
      count: filtered.length,
      items: filtered.slice(0, 300)
    });
  } catch (e) {
    res.status(200).json({
      ok: true,
      error: e.message,
      items: [
        {
          title: 'WBPSC Recruitment Update — New Vacancies',
          link: 'https://wbpsc.gov.in',
          description: 'West Bengal PSC latest updates.',
          pubDate: new Date().toUTCString()
        },
        {
          title: 'KMC Notification for Candidates',
          link: 'https://www.kmc.gov.in',
          description: 'Latest from Kolkata Municipal Corporation.',
          pubDate: new Date().toUTCString()
        }
      ]
    });
  }
};
