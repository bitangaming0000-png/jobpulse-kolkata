import { XMLParser } from 'fast-xml-parser';

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

export const handler = async () => {
  try {
    const feedsResp = await import('../../data/feeds.json', { assert: { type: 'json' } });
    const raw = feedsResp.default;
    const FEEDS = Array.isArray(raw) ? raw : (raw.sources || []);
    const KEYWORDS = (Array.isArray(raw) ? [] : (raw.filter_keywords_any || []))
      .concat(['West Bengal','WB','Kolkata','Howrah','Hooghly','Hugli','Nadia','North 24 Parganas','South 24 Parganas','Darjeeling','Jalpaiguri','Alipurduar','Cooch Behar','Malda','Murshidabad','Bankura','Birbhum','Purulia','Paschim Medinipur','Purba Medinipur','Jhargram','Asansol','Durgapur','Siliguri','Kharagpur','Haldia','Bardhaman','Burdwan']);

    const fetches = FEEDS.map(async s => {
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
        items = items.filter(it => includesAny(it.title + ' ' + it.description, KEYWORDS));
        items = items.map(it => ({ ...it, description: rewriteText(it.description) }));
        return items;
      } catch (e) {
        console.error('Feed error', s.url, e.message);
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
