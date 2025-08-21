// === Dark/Light Mode ===
const modeToggle = document.getElementById("modeToggle");
if (modeToggle) {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  modeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

  modeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    modeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
  });
}

// === Page Detection ===
const page = document.body.getAttribute("data-page");

// === Render a Card ===
function renderCard(container, post, fromPage) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <img src="${post.thumbnail || "dummy-photo.svg"}" alt="">
    <h3>${post.title}</h3>
    <p>${post.description ? post.description.slice(0, 100) + "..." : ""}</p>
  `;
  card.addEventListener("click", () => {
    window.location.href = `post.html?id=${encodeURIComponent(post.id)}&from=${fromPage}`;
  });
  container.appendChild(card);
}

// === Load Data from Netlify Function ===
async function loadPosts() {
  try {
    const res = await fetch("/.netlify/functions/fetchFeeds");
    const posts = await res.json();

    if (page === "home") {
      const latestPosts = document.getElementById("latestPosts");
      posts.slice(0, 6).forEach(p => renderCard(latestPosts, p, "home"));
    }

    if (page === "jobs") {
      const jobsList = document.getElementById("jobsList");
      posts.filter(p => p.category === "Job").forEach(p => renderCard(jobsList, p, "jobs"));
    }

    if (page === "news") {
      const newsList = document.getElementById("newsList");
      posts.filter(p => p.category === "News").forEach(p => renderCard(newsList, p, "news"));
    }

    if (page === "post") {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get("id");
      const post = posts.find(p => p.id === id);

      if (post) {
        document.getElementById("postTitle").textContent = post.title;
        document.getElementById("postMeta").textContent = "Published: " + (post.pubDate || "Unknown");
        document.getElementById("postImage").src = post.thumbnail || "dummy-photo.svg";
        document.getElementById("postBody").innerHTML = post.description || "";
        document.getElementById("postSource").href = post.link;
      }
    }

  } catch (err) {
    console.error("Error loading posts:", err);
  }
}

loadPosts();
