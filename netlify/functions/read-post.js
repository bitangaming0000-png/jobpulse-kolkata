// netlify/functions/read-post.js
const { readFile } = require('fs/promises');
const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const fetchFn = global.fetch;

function json(status, obj){
  return { statusCode: status, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' }, body: JSON.stringify(obj) };
}

function findAllowlistPath(){
  const candidates = [
    path.join(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'data', 'allow_full_domains.json'),
    path.join(__dirname, '..', '..', 'data', 'allow_full_domains.json'),
    path.resolve(process.cwd(), 'data', 'allow_full_domains.json')
  ];
  return candidates.find(p => fs.existsSync(p));
}

async function loadAllowlist(){
  const p = findAllowlistPath();
  if(!p) return [];
  const raw = await readFile(p, 'utf8');
  const j = JSON.parse(raw);
  return Array.isArray(j) ? j : (j.allow_full_domains || []);
}

function extractBody(html=''){
  // very simple extraction of <title> and <body> content
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  return { title, body };
}

function sanitize(html){
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','figure','figcaption','table','thead','tbody','tfoot','tr','td','th','h1','h2','h3','h4','h5']),
    allowedAttributes: {
      a: ['href','name','target','rel'],
      img: ['src','alt','title','loading','width','height'],
      '*': ['class','id','style','aria-*']
    },
    allowedSchemes: ['http','https','data','mailto','tel'],
    transformTags: {
      'a': (tagName, attribs) => {
        if (attribs.href && !/^https?:/i.test(attribs.href) && !/^#/.test(attribs.href)) {
          // strip potentially dangerous protocols
          delete attribs.href;
        }
        attribs.rel = 'noopener';
        attribs.target = '_blank';
        return { tagName, attribs };
      }
    },
    // keep unicode chars as-is; no further encoding
    textFilter: (text) => text
  });
}

function htmlToText(html='') {
  try {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch { return ''; }
}

function normalizeUrl(raw){
  if(!raw) return null;
  let s = decodeURIComponent(String(raw).trim());
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}

module.exports.handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || '');
    const raw = qs.get('link');
    const link = normalizeUrl(raw);
    if(!link) return json(400, { error: 'Invalid or missing link' });

    const host = new URL(link).host.replace(/^www\./,'');
    const allow = await loadAllowlist();
    const allowed = allow.includes(host);

    const res = await fetchFn(link, { headers: { 'User-Agent':'Mozilla/5.0 (JobPulse Reader)' } });
    if(!res.ok) return json(200, { allowed:false, title:'', html:'', excerpt:`Source fetch failed (${res.status}).`, link });

    const page = await res.text();
    const { title, body } = extractBody(page);

    if (allowed) {
      const clean = sanitize(body);
      return json(200, { allowed:true, title, html: clean, link });
    }

    // Not allowed: return long excerpt in original language (no rewriting)
    const text = htmlToText(body);
    const excerpt = text.slice(0, 12000); // long excerpt, ~12k chars
    return json(200, { allowed:false, title, html:'', excerpt, link });

  } catch (e) {
    return json(500, { error: e.message });
  }
};
