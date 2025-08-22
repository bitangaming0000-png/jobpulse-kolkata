const Parser = require("rss-parser");
const parser = new Parser();

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

const WB_WORDS = ["West Bengal","W.B.","WB","Kolkata","Howrah","Siliguri","Asansol","Durgapur","Haldia","Kharagpur","Bardhaman","Jalpaiguri","Malda","Bankura","Purulia","Hooghly","Hugli","Nadia","Birbhum","Murshidabad","Darjeeling","Cooch Behar","Koch Bihar","Alipurduar","North 24 Parganas","South 24 Parganas","Paschim Medinipur","Purba Medinipur","Medinipur","Kalimpong","Bidhannagar","Salt Lake","New Town","Dumdum","Barrackpore","Serampore","Bally","Barasat","Santiniketan","Kalyani","Halisahar","Chandannagar","WBPSC","Kolkata Police","WBP","WBPDCL","KMDA","KMC"];

function isWB(hit) {
  const hay = (
    (hit.title || "") + " " +
    (hit.contentSnippet || hit.content || "") + " " +
    (hit.source || "") + " " +
    (hit.categories ? hit.categories.join(" ") : "")
  ).toLowerCase();
  return WB_WORDS.some(w => hay.toLowerCase().includes(w.toLowerCase()));
}

async function fetchFeeds(urls, category) {
  let items = [];
  for (const url of urls) {
    try {
      const parsed = await parser.parseURL(url);
      const srcTitle = parsed.title || url;
      items = items.concat(
        (parsed.items || []).map(i => ({
          id: i.guid || i.link || (i.title + "::" + srcTitle),
          title: i.title,
          description: i.contentSnippet || i.content || "",
          link: i.link,
          pubDate: i.pubDate || i.isoDate || new Date().toISOString(),
          source: srcTitle,
          category,
          categories: i.categories || [],
          thumbnail:
            (i.enclosure && i.enclosure.url) ||
            `https://picsum.photos/400/220?random=${Math.floor(Math.random()*1000)}`
        }))
      );
    } catch (e) {
      console.error("RSS error:", url, e.message);
    }
  }
  return items;
}

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const type = (params.type || "all").toLowerCase(); // jobs|news|exams|all
    const onlyWB = params.onlyWB === "1" || params.onlywb === "1";

    const wantJobs = type === "all" || type === "jobs";
    const wantNews = type === "all" || type === "news";
    const wantExams = type === "all" || type === "exams";

    const [jobs, news, exams] = await Promise.all([
      wantJobs ? fetchFeeds(FEEDS.jobs, "Job") : Promise.resolve([]),
      wantNews ? fetchFeeds(FEEDS.news, "News") : Promise.resolve([]),
      wantExams ? fetchFeeds(FEEDS.exams, "Exam") : Promise.resolve([]),
    ]);

    let finalJobs = jobs.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
    if (onlyWB) finalJobs = finalJobs.filter(isWB);

    const payload = {
      jobs: finalJobs,
      news: news.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate)),
      exams: exams.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate))
    };

    payload.trending = [...payload.jobs.slice(0,15), ...payload.news.slice(0,15)]
      .sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate)).slice(0,30);

    if (type === "jobs")  return { statusCode: 200, body: JSON.stringify({ jobs: payload.jobs }) };
    if (type === "news")  return { statusCode: 200, body: JSON.stringify({ news: payload.news }) };
    if (type === "exams") return { statusCode: 200, body: JSON.stringify({ exams: payload.exams }) };
    return { statusCode: 200, body: JSON.stringify(payload) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
