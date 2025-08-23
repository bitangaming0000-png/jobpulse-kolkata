// netlify/functions/archive.js
// Archives WB job/news posts. Safe path resolution + no top-level await.

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

async function readFeedsConfig() {
  // Build absolute path that works in Netlify Functions
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd(); // e.g. /var/task
  const feedsPath = `${root}/data/feeds.json`;
  const rawText = await readFile(feedsPath, 'utf8');
  return JSON.parse(rawText);
}

async function fetchWBItems() {
  const cfg = await readFeedsConfig();
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
    const key = (it.link ||
