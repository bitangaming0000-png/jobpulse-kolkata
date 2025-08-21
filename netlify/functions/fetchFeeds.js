// Netlify Function: fetchFeeds.js (West Bengal – all areas)
// - Fetch wide set of job + job-news feeds
// - No server-side location filtering (returns everything)
// - Tags items with WB district/city if mentioned
// - (Optional) Telegram batch autopost via env vars

// ===== JOB FEEDS (add more as you like) =====
const JOB_FEEDS = [
  "https://www.timesjobs.com/rss/jobs",
  "https://remotive.com/feed",
  "https://weworkremotely.com/remote-jobs.rss",
  // Directories (may or may not return RSS; we skip if invalid):
  "https://www.higheredjobs.com/rss/",
  "https://www.jobs.ac.uk/feeds"
];

// ===== NEWS / CAREER BLOGS (job-related news/tips) =====
const NEWS_FEEDS = [
  "https://acarasolutions.com/blog/category/job-seeker/feed",
  "https://thebiggamehunter.us/feed",
  "https://theundercoverrecruiter.com/feed",
  "https://careerbands.com/feed",
  "https://nationalable.org/blog/feed",
  "https://jobjenny.com/the-blog?format=rss",
  "https://alvcoaching.com/feed",
  "https://koriburkholder.com/feed",
  "https://graduatecoach.co.uk/feed",
  "https://telmasullivan.com/blog?format=rss",
  "https://thecareer.coach/feed/rss2",
  "https://pauercoaching.com/feed",
  "https://ten-percent.co.uk/feed",
  // India news sections that often cover jobs/HR
  "https://timesofindia.indiatimes.com/rssfeeds/29528284.cms",
  "https://timesofindia.indiatimes.com/rssfeeds/913168846.cms",
  "https://hr.economictimes.indiatimes.com/rss/workplace-4-0/recruitment",
  "https://hr.economictimes.indiatimes.com/rss/news/hr-policies-trends",
  // Feedspot directory links (may be HTML; skipped if invalid):
  "https://rss.feedspot.com/job_hunting_rss_feeds/",
  "https://rss.feedspot.com/career_coach_rss_feeds/"
];

// West Bengal districts & notable cities (for tagging only)
const WB_PLACES = [
  "Kolkata","Howrah","Hooghly","North 24 Parganas","South 24 Parganas","Nadia",
  "Murshidabad","Birbhum","Purba Bardhaman","Paschim Bardhaman","Bankura",
  "Purulia","Jhargram","Paschim Medinipur","Purba Medinipur","Malda",
  "Uttar Dinajpur","Dakshin Dinajpur","Darjeeling","Kalimpong","Alipurduar",
  "Cooch Behar","Jalpaiguri",
  "Asansol","Durgapur","Siliguri","Kharagpur","Haldia","Digha","Kalyani",
  "Bidhannagar","Barasat","Barrackpore","Salt Lake","New Town"
];

const toLower = s => (s || "").toLowerCase();
function detectWBRegion(title = "", description = "") {
  const blob = toLower(`${title} ${description}`);
  const hit = WB_PLACES.find(p => blob.includes(p.toLowerCase()));
  return hit || "";
}

// Convert RSS to JSON via rss2json; invalid feeds are skipped safely.
async function fetchRssAsJson(rssUrl) {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(url, { timeout: 15000 });
  if (!res.ok) throw new Error(`Failed RSS ${res.status}`);
  return res.json();
}

function stripHtml(s = "") {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function normalize(items = [], type) {
  return items.map(it => {
    const title = it.title || "";
    const description = stripHtml(it.description || "");
    const region = detectWBRegion(title, description);
    return {
      type,                      // "job" | "news"
      title,
      link: it.link || "",
      source: it.author || it.creator || it.source || "",
      description,
      pubDate: it.pubDate || it.pub_date || it.isoDate || "",
      thumbnail: (it.enclosure && it.enclosure.link) || "",
      region
    };
  });
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
    const failedFeeds = [];

    // JOBS
    await Promise.all(
      JOB_FEEDS.map(async (u) => {
        try {
          const data = await fetchRssAsJson(u);
          results.jobs.push(...normalize(data.items || [], "job"));
        } catch {
          failedFeeds.push({ type: "job", url: u });
        }
      })
    );

    // NEWS
    await Promise.all(
      NEWS_FEEDS.map(async (u) => {
        try {
          const data = await fetchRssAsJson(u);
          results.news.push(...normalize(data.items || [], "news"));
        } catch {
          failedFeeds.push({ type: "news", url: u });
        }
      })
    );

    // Dedupe + trim (no location filter — show everything; tag regions if found)
    results.jobs = dedupeByTitleLink(results.jobs).slice(0, 200);
    results.news = dedupeByTitleLink(results.news).slice(0, 200);

    // OPTIONAL: Telegram batch autopost
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (token && chatId) {
        const toSend = [...results.jobs.slice(0, 5), ...results.news.slice(0, 5)];
        await Promise.all(
          toSend.map(async item => {
            const text = `${item.type === "job" ? "🧰 Job" : "📰 News"}: ${item.title}${item.region ? ` [${item.region}]` : ""}\n${item.link}`;
            const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
            await fetch(url);
          })
        );
      }
    } catch { /* ignore */ }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: results.jobs, news: results.news, failedFeeds })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
