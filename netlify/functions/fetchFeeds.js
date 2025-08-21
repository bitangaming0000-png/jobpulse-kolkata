const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media", { keepArray: true }],
      ["media:thumbnail", "thumbnail"],
      ["image", "image"],
    ],
  },
});

// === Feeds to fetch ===
const feeds = [
  { name: "Remotive Jobs", url: "https://remotive.com/feed", type: "job" },
  { name: "We Work Remotely", url: "https://weworkremotely.com/remote-jobs.rss", type: "job" },
  { name: "HigherEdJobs", url: "https://www.higheredjobs.com/rss/", type: "job" },
  { name: "Jobs.ac.uk", url: "https://www.jobs.ac.uk/feeds", type: "job" },
  { name: "JobPulse News (Feedspot)", url: "https://rss.feedspot.com/job_hunting_rss_feeds/", type: "news" },
  { name: "Undercover Recruiter", url: "https://theundercoverrecruiter.com/feed", type: "news" },
  { name: "The Big Game Hunter", url: "https://thebiggamehunter.us/feed", type: "news" },
];

// === Extract first image from item if possible ===
function extractImage(item) {
  if (item.media && item.media[0] && item.media[0].$.url) return item.media[0].$.url;
  if (item.thumbnail) return item.thumbnail;
  if (item.image) return item.image;
  const match = (item.content || item["content:encoded"] || "").match(/<img.*?src="(.*?)"/i);
  if (match) return match[1];
  return null;
}

exports.handler = async function () {
  try {
    let jobs = [];
    let news = [];

    for (let feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);
        const items = (parsed.items || []).map((item, i) => ({
          id: item.guid || item.link || feed.url + "#" + i,
          title: item.title || "Untitled",
          link: item.link,
          description: item.contentSnippet || item.content || "",
          pubDate: item.pubDate || new Date().toISOString(),
          thumbnail: extractImage(item),
          category: feed.type === "job" ? "Job" : "News",
          source: feed.name,
        }));
        if (feed.type === "job") jobs.push(...items);
        else news.push(...items);
      } catch (err) {
        console.error("Error fetching feed:", feed.url, err.message);
      }
    }

    // Sort newest first
    jobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    return {
      statusCode: 200,
      body: JSON.stringify({ jobs, news }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  } catch (err) {
    console.error("Global fetch error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
