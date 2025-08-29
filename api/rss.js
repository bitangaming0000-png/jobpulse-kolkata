// api/rss.js — Multi-source WB jobs/news feed (WBPSC, KMC, SarkariResult, FreeJobAlert, Employment News)
const FEEDS = [
  { url: 'https://wbpsc.gov.in/rss.xml', category: 'govt' },
  { url: 'https://www.kmcgov.in/rss/news.xml', category: 'govt' },
  { url: 'https://www.sarkariresult.com/feed', category: 'news' },
  { url: 'https://www.freejobalert.com/feed', category: 'news' },
  { url: 'https://www.employmentnews.gov.in/RSS.aspx', category: 'govt' }
];

// West Bengal-only filter (title/desc/link)
const WB_RE = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Midnapore|Bardhaman|Burdwan|Asansol|Bankura|Purulia|Malda|Murshidabad|Jalpaiguri|Cooch Behar|Alipurduar)\b/i;

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
  const out = [];
  // RSS 2.0 <item>
  let m; const re = /<item\b[\s\S]*?<\/item>/gi;
  while ((m = re.exec(xml)) !== null) {
    const b = m[0];
    out.push({
      title: strip(getTag(b, 'title')),
      link: strip(getTag(b, 'link')) || strip(getTag(b, 'guid')),
      description: strip(getTag(b, 'description')),
      pubDate: strip(getTag(b, 'pubDate'))
    });
  }
  // Atom <entry> fallback
  if (!out.length) {
    let ma; const reA = /<entry\b[\s\S]*?<\/entry>/gi;
    while ((ma = reA.exec(xml)) !== null) {
      const b = ma[0];
      const lm = b.match(/<link[^>]*href="([^"]+)"/i);
      out.push({
        title: strip(getTag(b, 'title')),
        link: lm ? lm[1] : strip(getTag(b, 'id')),
        description: strip(getTag(b, 'summary')) || strip(getTag(b, 'content')),
        pubDate: strip(getTag(b, 'updated')) || strip(getTag(b, 'published'))
      });
    }
  }
  return out;
}

function isWB(it) {
  const s = `${it.title || ''} ${it.description || ''} ${it.link || ''}`;
  return WB_RE.test(s);
}

module.exports = async (req, res) => {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(async f => {
        const r = await fetch(f.url, { headers: { 'user-agent': 'jobpulse-rss-bot' } });
        const xml = await r.text();
        return parseRSS(xml).map(x => ({ ...x, _source: f.url, _category: f.category || 'news' }));
      })
    );

    // Merge fulfilled feeds
    let all = [];
    for (const r of results) if (r.status === 'fulfilled') all = all.concat(r.value);

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

    // Sort newest first using pubDate; tie-breaker by title
    filtered.sort((a, b) => {
      const da = Date.parse(a.pubDate || '') || 0;
      const db = Date.parse(b.pubDate || '') || 0;
      if (db !== da) return db - da;
      return (b.title || '').localeCompare(a.title || '');
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // cache 5 mins
    return res.status(200).json({
      ok: true,
      count: filtered.length,
      items: filtered.slice(0, 200)
    });
  } catch (e) {
    // Never return empty — homepage should always have content
    return res.status(200).json({
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
