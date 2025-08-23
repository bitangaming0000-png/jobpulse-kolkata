// netlify/functions/visitors.js
const fetch = global.fetch;

async function countWithBlobs() {
  try {
    const mod = await import('@netlify/blobs');
    const store = mod.getStore('metrics');
    const key = 'visitors.json';
    const existing = (await store.get(key, { type: 'json' })) || { count: 0 };
    const next = (existing.count || 0) + 1;
    await store.set(key, JSON.stringify({ count: next }), { metadata: { contentType: 'application/json' } });
    return next;
  } catch {
    return null;
  }
}

async function countWithCountAPI() {
  try {
    const r = await fetch('https://api.countapi.xyz/hit/jobpulse-kolkata/site-visits');
    if (!r.ok) throw new Error('countapi http');
    const j = await r.json();
    return j.value || j.count || null;
  } catch {
    return null;
  }
}

module.exports.handler = async () => {
  // Try Blobs first (best), then CountAPI, else 0
  let value = await countWithBlobs();
  if (value == null) value = await countWithCountAPI();
  if (value == null) value = 0;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ value })
  };
};
