// netlify/functions/rss.js (CommonJS)
const { XMLParser } = require('fast-xml-parser');
const { readFile } = require('fs/promises');
const path = require('path');
const fetch = global.fetch; // Netlify runtime has fetch

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true
});

function rewriteText(text) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > 220 ? t.slice(0, 220) + '...' : t;
}

function normalizeFeed(json, sourceUrl) {
  const items = [];
  // RSS 2.0
  if (json?.rss?.channel) {
    const ch = json.rss.channel;
    const arr = Array.isArray(ch.item) ? ch.item : (ch.item ? [ch.item] : []);
    for (const it of arr) {
      items.push({
        title: it.title || '',
        link: it.link || '',
        description: it.description || it.summary || '',
        pubDate: it.pubDate || it['dc:date'] || it['updated'] || '',
        source: sourceUrl
      });
    }
  }
  // Atom
  if (json?.feed?.entry) {
    const arr = Array.isArray(json.feed.entry) ? json.feed.entry : [json.feed.entry];
    for (const it of arr) {
      const link = Array.isArray(it.link)
        ? (it.link.find(l => l['@_rel'] === 'alternate')?.['@_href'] || it.link[0]['@_href'])
        : (it.link?.['@_href'] || '');
      items.push({
        title: (it.title && (it.title._text || it.title)) || '',
        link,
        description: (it.summary && (it.summary._text || it.summary)) || (it.content && (it.content._text || it.content)) || '',
        pubDate: it.updated || it.published || '',
        source: sourceUrl
      });
    }
  }
  return items;
}

function includesAny(haystack, needles) {
  const h = (haystack || '').toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}

async function readFeedsConfig() {
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd(); // e.g. /var/task
  const feedsPath = path.join(root, 'data', 'feeds.json');
  const raw = await readFile(feedsPath, 'utf8');
  return JSON.parse(raw);
}

module.exports.handler = async () => {
  try {
    const cfg = await readFeedsConfig();
    const FEEDS = Array.isArray(cfg) ? cfg : (cfg.sources || []);
    const KEYWORDS = (Array.isArray(cfg) ? [] : (cfg.filter_keywords_any || []))
      .concat(['West Bengal','WB','Kolkata','Howrah','Hooghly','Hugli','Nadia','North 24 Parganas','South 24 Parganas','Darjeeling','Jalpaiguri','Alipurduar','Cooch Behar','Malda','Murshidabad','Bankura','Birbhum','Purulia','Paschim Medinipur','Purba Medinipur','Jhargram','Asansol','Durgapur','Siliguri','Kharagpur','Haldia','Bardhaman','Burdwan']);

    const fetches = FEEDS.map(async (s) => {
      try {
        const resp = await fetch(s.url, {
          headers: {
            'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (NetlifyFunction; +rss-jobpulse-kolkata)'
          }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const xml = await resp.text();
        const json = parser.parse(xml);
        let items = normalizeFeed(json, s.url);
        items = items.map(it => ({ ...it, category: s.category || 'news' }));
        items = items
          .filter(it => includesAny(`${it.title} ${it.description}`, KEYWORDS))
          .map(it => ({ ...it, description: rewriteText(it.description) }));
        return items;
      } catch (e) {
        console.error('Feed error', s.url, e.message);
        return [];
      }
    });

    const results = (await Promise.all(fetches)).flat();

    // de-dupe + sort
    const seen = new Set();
    const deduped = [];
    for (const it of results) {
      const key = (it.link || '') + '|' + (it.title || '');
      if (!seen.has(key)) { seen.add(key); deduped.push(it); }
    }
    deduped.sort((a,b) => {
      const da = Date.parse(a.pubDate) || 0;
      const db = Date.parse(b.pubDate) || 0;
      return db - da || a.title.localeCompare(b.title);
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({ items: deduped })
    };
  } catch (err) {
    console.error('RSS function error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
