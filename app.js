// === Dark/Light Mode ===
const modeToggle = document.getElementById("modeToggle");
if (modeToggle) {
  // Load saved mode
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  modeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

  // Toggle
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

// === Render Cards (Jobs / News / Home) ===
function renderCard(container, post, fromPage) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <img src="${post.image || "dummy-photo.svg"}" alt="">
    <h3>${post.title}</h3>
    <p>${post.snippet || ""}</p>
  `;
  // ✅ Add ?from= so post page knows back button
  card.addEventListener("click", () => {
    window.location.href = `post.html?id=${encodeURIComponent(post.id)}&from=${fromPage}`;
  });
  container.appendChild(card);
}

// === Example Data Fetch Simulation ===
// You will connect this with RSS fetching (fetchFeeds.js) later
const dummyPosts = [
  { id: "1", title: "Government Job – Clerk", snippet: "Apply now for clerk posts", image: "dummy-photo.svg" },
  { id: "2", title: "Private Job – Software Engineer", snippet: "Hiring freshers in IT", image: "dummy-photo.svg" },
  { id: "3", title: "Exam Update – WBPSC", snippet: "Admit card released", image: "dummy-photo.svg" }
];

// === Page Specific Rendering ===
if (page === "jobs") {
  const jobsList = document.getElementById("jobsList");
  dummyPosts.forEach(p => renderCard(jobsList, p, "jobs"));
}

if (page === "news") {
  const newsList = document.getElementById("newsList");
  dummyPosts.forEach(p => renderCard(newsList, p, "news"));
}

if (page === "home") {
  const latestPosts = document.getElementById("latestPosts");
  dummyPosts.forEach(p => renderCard(latestPosts, p, "home"));
}

// === Post Page ===
if (page === "post") {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  // Dummy content (replace with RSS later)
  const post = dummyPosts.find(p => p.id === id) || dummyPosts[0];

  document.getElementById("postTitle").textContent = post.title;
  document.getElementById("postMeta").textContent = "Published: Today";
  document.getElementById("postImage").src = post.image;
  document.getElementById("postBody").innerHTML = `
    <p>${post.snippet}</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
    This will later be replaced by full AI-updated job/news description.</p>
  `;
  document.getElementById("postSource").href = "https://example.com";
}
