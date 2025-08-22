// Generic HTML list scraper for sites without RSS
// Usage from jobful.js: scrapeList({ url, itemSelector, titleSelector, linkSelector, dateSelector, base, type, name, region })
const cheerio = require("cheerio");

/** Resolve relative URLs */
function abs(base, href) {
  try { return new URL(href, base).toString(); } catch { return href || base; }
}

/** Parse a date string safely; fall back to now */
function parseDate(txt){
  if(!txt) return new Date().toISOString();
  const d = new Date(txt);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Scrape a generic list page.
 * @param {Object} cfg
 *   - url: page URL
 *   - itemSelector: CSS selector for each item row/card
 *   - titleSelector: CSS selector inside item for title text
 *   - linkSelector: CSS selector inside item for href (if omitted, use titleSelector@href or first <a>)
 *   - dateSelector: CSS selector inside item for date text (optional)
 *   - base: base URL for resolving relative links
 *   - type: "job"|"news"
 *   - name: source name to attach
 *   - region: optional region tag
 */
async function scrapeList(cfg) {
  const {
    url, itemSelector, titleSelector,
    linkSelector, dateSelector, base,
    type, name, region
  } = cfg;

  const res = await fetch(url, { headers: { "User-Agent": "JobPulseBot/1.0 (+https://jobpulse-kolkata.netlify.app)" }});
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $(itemSelector).each((i, el)=>{
    const $el = $(el);
    const $title = titleSelector ? $el.find(titleSelector).first() : $el.find("a").first();
    const title = ($title.text() || "").trim();
    let href = "";
    if (linkSelector) {
      const $a = $el.find(linkSelector).first();
      href = $a.attr("href") || "";
    } else {
      href = $title.attr("href") || $el.find("a").first().attr("href") || "";
    }
    const link = abs(base || url, href);
    const dateTxt = dateSelector ? ($el.find(dateSelector).first().text() || "").trim() : "";
    const pubDate = parseDate(dateTxt);

    if (title && link) {
      items.push({
        id: `${link}`,
        title,
        link,
        description: "", // could add summary by taking a snippet from $el.text()
        pubDate,
        thumbnail: "",   // most govt sites have no thumbs; frontend falls back to dummy
        category: type === "job" ? "Job" : "News",
        source: name,
        sourceKey: name.toLowerCase().replace(/\s+/g,"_"),
        region: region || null
      });
    }
  });
  return items;
}

module.exports = { scrapeList };
