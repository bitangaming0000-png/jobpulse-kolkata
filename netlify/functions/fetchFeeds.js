import Parser from "rss-parser";

const parser = new Parser();

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

    const parseFeed = async (f, category) => {
      const feed = await parser.parseURL(f.url);
      return feed.items.map(item => {
        // Try multiple ways to extract images
        let thumb = "dummy-photo.svg";
        if (item.enclosure && item.enclosure.url) {
          thumb = item.enclosure.url;
        } else if (
          item["media:content"] &&
          item["media:content"]["$"] &&
          item["media:content"]["$"].url
        ) {
          thumb = item["media:content"]["$"].url;
        } else if (item.content && item.content.match(/<img[^>]+src="([^">]+)"/)) {
          thumb = item.content.match(/<img[^>]+src="([^">]+)"/)[1];
        }

        return {
          id: item.link,
          title: item.title,
          link: item.link,
          description: item.contentSnippet || item.content || "",
          pubDate: item.pubDate,
          thumbnail: thumb,
          category,
          source: f.name
        };
      });
    };

    // Jobs
    for (const f of feeds.jobs) {
      try {
        jobs = jobs.concat(await parseFeed(f, "Job"));
      } catch (err) {
        console.error("Job feed error", f.url, err);
      }
    }

    // News
    for (const f of feeds.news) {
      try {
        news = news.concat(await parseFeed(f, "News"));
      } catch (err) {
        console.error("News feed error", f.url, err);
      }
    }

    jobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

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
