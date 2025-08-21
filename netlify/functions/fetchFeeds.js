import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media", { keepArray: true }],
      ["media:thumbnail", "thumbnail"],
      ["description", "description"],
    ]
  }
});

// --- Your feed list (jobs + news)
const feeds = [
  { name: "We Work Remotely", url: "https://weworkremotely.com/remote-jobs.rss", type: "job" },
  { name: "Remotive", url: "https://remotive.com/feed", type: "job" },
  { name: "HigherEdJobs", url: "https://www.higheredjobs.com/rss/", type: "job" },
  { name: "Acara Blog", url: "https://acarasolutions.com/blog/category/job-seeker/feed", type: "news" },
  { name: "Undercover Recruiter", url: "https://theundercoverrecruiter.com/feed", type: "news" },
  { name: "Big Game Hunter", url: "https://thebiggamehunter.us/feed", type: "news" }
  // 👉 Add more feeds here
];

export async function handler() {
  try {
    let allPosts = [];

    for (const feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);

        parsed.items.slice(0, 15).forEach((item, idx) => {
          let img = null;

          // Extract image (try multiple sources)
          if (item.enclosure?.url) img = item.enclosure.url;
          else if (item.media && item.media[0]?.$.url) img = item.media[0].$.url;
          else if (item.thumbnail) img = item.thumbnail;
          else {
            // try to parse first <img> from description
            const match = item.description?.match(/<img.*?src="(.*?)"/i);
            if (match) img = match[1];
          }

          allPosts.push({
            id: `${feed.name}-${idx}-${Date.now()}`,
            title: item.title || "Untitled",
            link: item.link,
            description: (item.contentSnippet || item.description || "").replace(/<[^>]+>/g,"").slice(0, 300) + "...",
            fullDescription: item.content || item.description || "",
            pubDate: item.pubDate || new Date().toISOString(),
            source: feed.name,
            type: feed.type,
            category: guessCategory(item.title || ""),
            education: guessEducation(item.title || ""),
            thumbnail: img || "dummy-photo.svg"
          });
        });
      } catch (err) {
        console.error(`❌ Error fetching ${feed.url}:`, err.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(allPosts)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}

// --- Helpers ---
function guessCategory(title){
  title = title.toLowerCase();
  if(title.includes("teacher") || title.includes("school")) return "Education";
  if(title.includes("bank")) return "Banking/Finance";
  if(title.includes("nurse") || title.includes("doctor")) return "Healthcare";
  if(title.includes("developer") || title.includes("engineer") || title.includes("tech")) return "IT/Tech";
  if(title.includes("govt") || title.includes("government")) return "Govt";
  if(title.includes("walk-in")) return "Walk-in";
  if(title.includes("remote") || title.includes("work from home")) return "Remote/International";
  return "Others";
}

function guessEducation(title){
  title = title.toLowerCase();
  if(title.includes("10th")) return "10th Pass";
  if(title.includes("12th")) return "12th Pass";
  if(title.includes("graduate") || title.includes("bachelor")) return "Graduate";
  if(title.includes("post graduate") || title.includes("master") || title.includes("mba")) return "Post Graduate";
  return "";
}
