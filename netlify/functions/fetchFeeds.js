import Parser from "rss-parser";

const parser = new Parser();

// Example: You can add/remove feeds here
const feeds = {
  jobs: [
    { name: "Remotive", url: "https://remotive.com/feed" },
    { name: "We Work Remotely", url: "https://weworkremotely.com/remote-jobs.rss" },
    { name: "HigherEdJobs", url: "https://www.higheredjobs.com/rss/" },
    { name: "Jobs.ac.uk", url: "https://www.jobs.ac.uk/feeds" }
  ],
  news: [
    { name: "The Big Game Hunter", url: "https://thebiggamehunter.us/feed" },
    { name: "Undercover Recruiter", url: "https://theundercoverrecruiter.com/feed" },
    { name: "CareerBands", url: "https://careerbands.com/feed" },
    { name: "Graduate Coach", url: "https://graduatecoach.co.uk/feed" }
  ]
};

export async function handler() {
  try {
    let jobs = [];
    let news = [];

    // Fetch jobs
    for (const f of feeds.jobs) {
      try {
        const feed = await parser.parseURL(f.url);
        const items = feed.items.map(item => ({
          id: item.link,
          title: item.title,
          link: item.link,
          description: item.contentSnippet || item.content || "",
          pubDate: item.pubDate,
          thumbnail: (item.enclosure && item.enclosure.url) || "dummy-photo.svg",
          category: "Job",
          source: f.name
        }));
        jobs = jobs.concat(items);
      } catch (e) {
        console.error("Job feed error", f.url, e);
      }
    }

    // Fetch news
    for (const f of feeds.news) {
      try {
        const feed = await parser.parseURL(f.url);
        const items = feed.items.map(item => ({
          id: item.link,
          title: item.title,
          link: item.link,
          description: item.contentSnippet || item.content || "",
          pubDate: item.pubDate,
          thumbnail: (item.enclosure && item.enclosure.url) || "dummy-photo.svg",
          category: "News",
          source: f.name
        }));
        news = news.concat(items);
      } catch (e) {
        console.error("News feed error", f.url, e);
      }
    }

    // Sort by date
    jobs.sort((a,b)=> new Date(b.pubDate)-new Date(a.pubDate));
    news.sort((a,b)=> new Date(b.pubDate)-new Date(a.pubDate));

    return {
      statusCode: 200,
      body: JSON.stringify({ jobs, news })
    };
  } catch (e) {
    console.error("fetchFeeds error", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch feeds" })
    };
  }
}
