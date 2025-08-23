// assets/js/utils.js

// Helper to format IST date/time
export function formatDateTimeIST(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

// Safe element creator
export function el(tag, cls, text) {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text) x.textContent = text;
  return x;
}

// Truncate text
export function truncate(text, n = 120) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n) + "…" : text;
}

// Safe URL check
export function safeURL(url) {
  try {
    const u = new URL(url);
    if (["http:", "https:"].includes(u.protocol)) return u.href;
    return "#";
  } catch {
    return "#";
  }
}

// Get query string param
export function getQuery(name) {
  return new URLSearchParams(location.search).get(name);
}
