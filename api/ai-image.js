// api/ai-image.js
// Builds a "safe" thumbnail using Unsplash Source and returns a base64 data URL.
// No API key needed. Suitable for small thumbnails.

module.exports = async (req, res) => {
  try {
    const q = (req.query.prompt || req.query.q || 'kolkata jobs').toString().slice(0, 120);
    const url = `https://source.unsplash.com/800x450/?${encodeURIComponent(q)}`;

    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error('image fetch failed');

    const buf = Buffer.from(await r.arrayBuffer());
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).json({ ok: true, dataUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
