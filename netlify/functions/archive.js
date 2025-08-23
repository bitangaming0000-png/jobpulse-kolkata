// netlify/functions/archive.js
// Scheduled function + API to archive WB job/news posts into Netlify Blobs.
//
// Endpoints:
//  - (Scheduled via cron) GET /.netlify/functions/archive   -> fetch+store today's items
//  - Manual refresh:       GET /.netlify/functions/archive?refresh=1
//  - List dates:           GET /.netlify/functions/archive?list=1
//  - Get by date:          GET /.netlify/functions/archive?date=YYYY-MM-DD
//  - Latest N items:       GET /.netlify/functions/archive?latest=100  (default 50)
//
// Requires: "fast-xml-parser" (already in package.json) and "@netlify/blobs".

import { XMLParser } from 'fast-xml-parser';
import { getStore } from '@netlify/blobs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true
});

function rewriteText(text) {
  if (!text) return '';
  let t = text.replace(/\s+/g, ' ').trim();
  return t.length > 220 ? t.slice(0, 220) + '...' : t;
}

function normalizeFeed(json, sourceUrl) {
  const items = [];
  if (json.rss && json.rss.channel) {
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
  if (json.feed && json.feed.entry) {
    const arr = Array.isArray(json.feed.entry) ? json.feed.entry : [json.feed.entry];
    for (const it of arr) {
      const link = Array.isArray(it.link) ? (it.link.find(l => l['@_rel'] === 'alternate')?.['@_href'] || it.link[0]['@_href']) : (it.link?.['@_href'] || '');
      items.push({
        title: it.title?._text || it.title || '',
        link,
        description: it.summary?._text || it.summary || it.content?._text || '',
        pubDate: it.updated || it.published || '',
        source: sourceUrl
      });
    }
  }
  return items;
}

function includesAny(haystack, needles) {
  const h = (haystack || '').toLowerCase();
  return needles.some(n => h.includes(n.toLowerCase()));
}

async function fetchWBItemsWithCategories() {
  const feedsResp = await import('../../data/feeds.json', { assert: { type: 'json' } });
  const raw = feedsResp.default;
  const FEEDS = Array.isArray(raw) ? raw : (raw.sources || []);
  const KEYWORDS = (Array.isArray(raw) ? [] : (raw.filter_keywords_any || []))
    .concat(['West Bengal','WB','Kolkata','Howrah','Hooghly','Hugli','Nadia','North 24 Parganas','South 24 Parganas','Darjeeling','Jalpaiguri','Alipurduar','Cooch Behar','Malda','Murshidabad','Bankura','Birbhum','Purulia','Paschim Medinipur','Purba Medinipur','Jhargram','Asansol','Durgapur','Siliguri','Kharagpur','Haldia','Bardhaman','Burdwan']);

  const fetches = FEEDS.map(async s => {
    try {
      const resp = await fetch(s.url, { headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      const json = parser.parse(xml);
      let items = normalizeFeed(json, s.url);
      items = items.map(it => ({ ...it, category: s.category || 'news' }));
      items = items.filter(it => includesAny(it.title + ' ' + it.description, KEYWORDS));
      items = items.map(it => ({ ...it, description: rewriteText(it.description) }));
      return items;
    } catch {
      return [];
    }
  });

  // Flatten + dedupe + sort
  const results = (await Promise.all(fetches)).flat();
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
  return deduped;
}

function ymd(d = new Date()) {
  const tz = 'Asia/Kolkata';
  const dd = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d));
  // Using en-CA gives YYYY-MM-DD; but to be safe:
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
  return iso; // YYYY-MM-DD
}

export const handler = async (event) => {
  try {
    const store = getStore('jobpulse-archive'); // bucket name
    const params = new URLSearchParams(event.rawQuery || '');

    // List dates
    if (params.has('list')) {
      const listing = await store.list(); // { objects: [{ key }...] } in newer SDK it returns array
      const keys = (listing?.objects || listing || []).map(o => (typeof o === 'string' ? o : o.key)).sort().reverse();
      return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ dates: keys }) };
    }

    // By date
    if (params.has('date')) {
      const key = params.get('date') + '.json';
      const json = await store.get(key, { type: 'json' });
      return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ date: params.get('date'), items: json || [] }) };
    }

    // Refresh/archive now (scheduled or manual)
    if (!params.has('latest') || params.has('refresh')) {
      const items = await fetchWBItemsWithCategories();
      const key = ymd() + '.json';
      // Merge with existing for the day
      const existing = await store.get(key, { type: 'json' }) || [];
      const merged = [...existing];
      const seen = new Set(existing.map(e => (e.link||'') + '|' + (e.title||'')));
      for (const it of items) {
        const k = (it.link||'') + '|' + (it.title||'');
        if (!seen.has(k)) { seen.add(k); merged.push(it); }
      }
      await store.set(key, JSON.stringify(merged), { metadata: { contentType: 'application/json' } });
      // Optional: keep last 365 keys only
      const listing = await store.list();
      const keys = (listing?.objects || listing || []).map(o => (typeof o === 'string' ? o : o.key)).sort().reverse();
      if (keys.length > 365) {
        const trash = keys.slice(365);
        await Promise.all(trash.map(k => store.delete(k)));
      }
      // return latest n
      const n = Number(params.get('latest') || 50);
      return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ archived: key, latest: merged.slice(0, n) }) };
    }

    // Latest N across most recent day by default
    const latestKey = ymd() + '.json';
    const today = await store.get(latestKey, { type: 'json' }) || [];
    const n = Number(params.get('latest') || 50);
    return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ items: today.slice(0, n) }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
