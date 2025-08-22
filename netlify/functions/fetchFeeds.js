import Parser from "rss-parser";

const parser = new Parser();

const feeds = [
  "https://acarasolutions.com/blog/category/job-seeker/feed",
  "https://thebiggamehunter.us/feed",
  "https://theundercoverrecruiter.com/feed",
  "https://remotive.com/feed",
  "https://weworkremotely.com/remote-jobs.rss",
  "https://www.higheredjobs.com/rss/",
  "https://www.jobs.ac.uk/feeds",
  "https://careerbands.com/feed",
  "https://graduatecoach.co.uk/feed",
  "https://ten-percent.co.uk/feed"
  // add more if needed
];

export async function handler(event, context) {
  try {
    let allItems = [];

    for (let url of feeds) {
      try {
        const feed = await parser.parseURL(url);
        const items = feed.items.slice(0, 10).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          source: feed.title,
          contentSnippet: item.contentSnippet || "",
          isoDate: item.isoDate || new Date().toISOString()
        }));
        allItems = allItems.concat(items);
      } catch (err) {
        console.error(`Failed to fetch ${url}`, err.message);
      }
    }

    // Sort latest first
    allItems.sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));

    return {
      statusCode: 200,
      body: JSON.stringify(allItems)
    };
  } catch (error) {
    console.error("Feed fetch error", error);
    return { statusCode: 500, body: "Error fetching feeds" };
  }
}
