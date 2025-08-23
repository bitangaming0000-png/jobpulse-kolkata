import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true
});

// Basic (very light) rewrite function to make descriptions more uniform.
function rewriteText(text) {
  if (!text) return '';
  // Remove excessive whitespace and common boilerplate.
  let t = text.replace(/\s+/g, ' ').trim();
  // Simple paraphrase vibes: prepend a neutral summary line if missing.
  if (t.length > 220) {
    return t.slice(0, 220) + '...';
  }
  return t;
}

// Helper to sniff RSS or Atom
function normalizeFeed(json, sourceUrl) {
  const items = [];
  // RSS 2.0
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
  // Atom
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

export const handler = async (event, context) => {
  try {
    // Read feed list & filters from local JSON (bundled with function via Netlify).
    const feedsResp = await import('../../data/feeds.json', { assert: { type: 'json' } });
    const FEEDS = feedsResp.default.sources || [];
    const KEYWORDS = feedsResp.default.filter_keywords_any || [];

    const fetches = FEEDS.map(async s => {
      try {
        const resp = await fetch(s.url, { headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const xml = await resp.text();
        const json = parser.parse(xml);
        let items = normalizeFeed(json, s.url);
        // Filter by West Bengal relevance
        items = items.filter(it => includesAny(it.title + ' ' + it.description, KEYWORDS));
        // Basic rewrite/trim
        items = items.map(it => ({ ...it, description: rewriteText(it.description) }));
        return items;
      } catch (e) {
        console.error('Feed error', s.url, e.message);
        return [];
      }
    });

    const results = (await Promise.all(fetches)).flat();

    // Deduplicate by link/title
    const seen = new Set();
    const deduped = [];
    for (const it of results) {
      const key = (it.link || '') + '|' + (it.title || '');
      if (!seen.has(key)) { seen.add(key); deduped.push(it); }
    }

    // Sort by date desc if present, else title
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
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
