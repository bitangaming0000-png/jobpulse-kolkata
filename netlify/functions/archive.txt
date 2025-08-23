// netlify/functions/archive.js
// Archives WB job/news posts. Safe for Netlify upload (no top-level await).

import { XMLParser } from 'fast-xml-parser';
import { readFile } from 'fs/promises';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true
});

function rewriteText(text) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
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
      const link = Array.isArray(it.link)
        ? (it.link.find(l => l['@_rel'] === 'alternate')?.['@_href'] || it.link[0]['@_href'])
        : (it.link?.['@_href'] || '');
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

async function fetchWBItems() {
  const feedsPath = new URL('../../data/feeds.json', import.meta.url);
  const rawText = await readFile(feedsPath, 'utf8');
  const cfg = JSON.parse(rawText);
  const FEEDS = Array.isArray(cfg) ? cfg : (cfg.sources || []);
  const KEYWORDS = (Array.isArray(cfg) ? [] : (cfg.filter_keywords_any || []))
    .concat(['West Bengal','WB','Kolkata','Howrah','Hooghly','Hugli','Nadia','North 24 Parganas','South 24 Parganas','Darjeeling','Jalpaiguri','Alipurduar','Cooch Behar','Malda','Murshidabad','Bankura','Birbhum','Purulia','Paschim Medinipur','Purba Medinipur','Jhargram','Asansol','Durgapur','Siliguri','Kharagpur','Haldia','Bardhaman','Burdwan']);

  const fetches = FEEDS.map(async s => {
    try {
      const resp = await fetch(s.url, { headers: { 'Accept':'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' }});
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      const json = parser.parse(xml);
      let items = normalizeFeed(json, s.url);
      items = items.map(it => ({ ...it, category: s.category || 'news' }));
      items = items.filter(it => includesAny(it.title + ' ' + it.description, KEYWORDS))
                   .map(it => ({ ...it, description: rewriteText(it.description) }));
      return items;
    } catch {
      return [];
    }
  });

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
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
}

export const handler = async (event) => {
  // Try to load Netlify Blobs inside the handler (no top-level await)
  let blobsOk = false;
  let getStoreFn = null;
  try {
    const mod = await import('@netlify/blobs');
    getStoreFn = mod.getStore;
    blobsOk = typeof getStoreFn === 'function';
  } catch {
    blobsOk = false;
  }

  // If Blobs isn’t available, just return live items (keeps UI working)
  if (!blobsOk) {
    const items = await fetchWBItems();
    return { statusCode: 200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ archived: false, items, note: 'Blobs unavailable; returned live items.' }) };
  }

  try {
    const store = getStoreFn('jobpulse-archive');
    const params = new URLSearchParams(event.rawQuery || '');

    if (params.has('list')) {
      const listing = await store.list();
      const keys = (listing?.objects || listing || []).map(o => (typeof o === 'string' ? o : o.key)).sort().reverse();
      return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ dates: keys }) };
    }

    if (params.has('date')) {
      const key = params.get('date') + '.json';
      const json = await store.get(key, { type: 'json' });
      return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ date: params.get('date'), items: json || [] }) };
    }

    // Archive today's items
    const items = await fetchWBItems();
    const key = ymd() + '.json';
    const existing = await store.get(key, { type: 'json' }) || [];
    const merged = [...existing];
    const seen = new Set(existing.map(e => (e.link||'') + '|' + (e.title||'')));
    for (const it of items) {
      const k = (it.link||'') + '|' + (it.title||'');
      if (!seen.has(k)) { seen.add(k); merged.push(it); }
    }
    await store.set(key, JSON.stringify(merged), { metadata: { contentType: 'application/json' } });

    const n = Number(params.get('latest') || 50);
    return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ archived: key, latest: merged.slice(0, n) }) };
  } catch (err) {
    // If anything goes wrong with Blobs, return live items instead of failing the deploy
    const items = await fetchWBItems();
    return { statusCode: 200, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify({ archived: false, items, note: 'Blobs error; returned live items.' }) };
  }
};
