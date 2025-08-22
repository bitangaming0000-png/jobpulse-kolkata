const Parser = require("rss-parser");
const parser = new Parser();

// RSS Feeds grouped by category
const FEEDS = {
  jobs: [
    "https://weworkremotely.com/remote-jobs.rss",
    "https://remotive.com/feed",
    "https://www.higheredjobs.com/rss/"
  ],
  news: [
    "https://theundercoverrecruiter.com/feed",
    "https://acarasolutions.com/blog/category/job-seeker/feed",
    "https://thebiggamehunter.us/feed"
  ],
  exams: [
    "https://www.upsc.gov.in/rss.xml",
    "https://ssc.nic.in/RSSFeed/latestnews.xml"
  ]
};

async function fetchFeeds(urls, category) {
  let items = [];
  for (let url of urls) {
    try {
      const parsed = await parser.parseURL(url);
      items = items.concat(
        parsed.items.map(i => ({
          id: i.guid || i.link,
          title: i.title,
          description: i.contentSnippet || i.content || "",
          link: i.link,
          pubDate: i.pubDate,
          source: parsed.title,
          category,
          thumbnail:
            i.enclosure?.url ||
            `https://picsum.photos/400/220?random=${Math.floor(Math.random()*1000)}`
        }))
      );
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
  return items;
}

exports.handler = async function () {
  try {
    const [jobs, news, exams] = await Promise.all([
      fetchFeeds(FEEDS.jobs, "Job"),
      fetchFeeds(FEEDS.news, "News"),
      fetchFeeds(FEEDS.exams, "Exam")
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobs: jobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)),
        news: news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)),
        exams: exams.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
