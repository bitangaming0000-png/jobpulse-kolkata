# JobPulse Kolkata

A clean, dark, modular **West Bengal** jobs portal. Netlify-ready, AdSense-ready, and split into separate pages/components for easy editing.

## Quick Start (GitHub + Netlify)

1. **Create a GitHub repo** and upload these files (or drag-drop the zip contents).
2. In your repo directory:
   ```bash
   npm install
   ```
3. **Netlify Deploy**:
   - Connect your GitHub repo in Netlify.
   - Netlify will read `netlify.toml` and serve the site from `/`.
   - Functions live in `netlify/functions` (RSS API at `/api/rss`).

### Local Dev
```bash
npm install -g netlify-cli   # if needed
netlify dev
```
Open http://localhost:8888

### Feeds (WB-only)
Edit **`data/feeds.json`**:
```json
{
  "sources": [...],
  "filter_keywords_any": ["West Bengal", "Kolkata", "Howrah", ...]
}
```
The Netlify Function fetches these feeds, filters to WB-related items, de-dupes, and sorts latest first.
The UI also enforces a WB keyword filter.

### AdSense
- Global script: `components/ads-head.html` (already set with your `ca-pub-5732778753912461`)
- Units (auto-injected):
  - `components/ads-unit-display.html`
  - `components/ads-unit-inarticle.html`
  - `components/ads-unit-multiplex.html`
- Add placeholders in pages:
```html
<ins class="ad-slot"></ins>                       <!-- display -->
<ins class="ad-slot" data-variant="inarticle"></ins>
<ins class="ad-slot" data-variant="multiplex"></ins>
```

### Structure
- `index.html`, `pages/*` — separate pages
- `components/*` — header, footer, AdSense includes
- `assets/css/style.css`, `assets/js/*` — styles & scripts
- `netlify/functions/rss.js` — serverless feed aggregator
- `data/feeds.json` — manage sources + WB keywords
- `netlify.toml` — publish + redirects
- `package.json` — deps (`fast-xml-parser`)

### License
MIT