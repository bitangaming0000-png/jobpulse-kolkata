// Netlify Function: fetchFeeds.js
// Aggregates many job + job-news RSS feeds, dedupes, lightly filters for Kolkata & nearby,
// and (optionally) pushes a small subset of new items to Telegram.

const JOB_FEEDS = [
  // TimesJobs – main RSS
  "https://www.timesjobs.com/rss/jobs",
  // Add more job feeds as you discover:
  // "https://<another-job-site>/rss",
];

const NEWS_FEEDS = [
  // Times of India – Kolkata City
  "https://timesofindia.indiatimes.com/rssfeeds/29528284.cms",
  // TOI – Education (careers/jobs related)
  "https://timesofindia.indiatimes.com/rssfeeds/913168846.cms",
  // Economic Times – HR / Recruitment
  "https://hr.economictimes.indiatimes.com/rss/workplace-4-0/recruitment",
  "https://hr.economictimes.indiatimes.com/rss/news/hr-policies-trends",
  // You can add more feeds here
];

const NEARBY_KEYWORDS = [
  "kolkata","howrah","hooghly","north 24 parganas","south 24 parganas",
  "new town","salt lake","dum dum","barrackpore","barasat",
  "bidhannagar","serampore","bally","shibpur","santragachi","newtown",
];

const isNear = (txt = "") => {
  const s = txt.toLowerCase();
  return NEARBY_KEYWORDS.some(k => s.includes(k));
};

async function fetchRssAsJson(rssUrl) {
  // Using rss2json proxy endpoint for simple XML->JSON conversion
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(url, { timeout: 15000 });
  if (!res.ok) throw new Error(`Failed RSS ${res.status}`);
  return res.json();
}

function normalize(items = [], type) {
  return items.map(it => ({
    type, // "job" | "news"
    title: it.title || "",
    link: it.link || "",
    source: it.author || it.creator || it.source || "",
    description: it.description || "",
    pubDate: it.pubDate || it.pub_date || it.isoDate || "",
    thumbnail: (it.enclosure && it.enclosure.link) || "", // may be empty
  }));
}

function dedupeByTitleLink(list) {
  const seen = new Set();
  return list.filter(x => {
    const k = (x.title + "|" + x.link).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

exports.handler = async () => {
  try {
    const results = { jobs: [], news: [] };

    // Fetch jobs
    await Promise.all(
      JOB_FEEDS.map(async (u) => {
        try {
          const data = await fetchRssAsJson(u);
          results.jobs.push(...normalize(data.items, "job"));
        } catch (e) {
          // ignore per-feed errors
        }
      })
    );

    // Fetch news
    await Promise.all(
      NEWS_FEEDS.map(async (u) => {
        try {
          const data = await fetchRssAsJson(u);
          results.news.push(...normalize(data.items, "news"));
        } catch (e) {
          // ignore per-feed errors
        }
      })
    );

    // Dedupe
    results.jobs = dedupeByTitleLink(results.jobs);
    results.news = dedupeByTitleLink(results.news);

    // Prefer near-Kolkata; if none, fall back to top N to avoid empty page
    const jobsNear = results.jobs.filter(j => isNear(j.title) || isNear(j.description));
    const newsNear = results.news.filter(n => isNear(n.title) || isNear(n.description));
    const jobsOut = jobsNear.length ? jobsNear : results.jobs.slice(0, 100);
    const newsOut = newsNear.length ? newsNear : results.news.slice(0, 100);

    // OPTIONAL: Server-side Telegram autopost (limited batch per run)
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (token && chatId) {
        const toSend = [...jobsOut.slice(0, 5), ...newsOut.slice(0, 5)];
        await Promise.all(
          toSend.map(async item => {
            const text = `${item.type === "job" ? "🧰 Job" : "📰 News"}: ${item.title}\n${item.link}`;
            const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
            await fetch(url);
          })
        );
      }
    } catch (_) {}

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: jobsOut, news: newsOut })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err.message || err) })
    };
  }
};
