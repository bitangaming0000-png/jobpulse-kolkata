// netlify/functions/ai-post.js (free fallback)
const fetchFn = global.fetch;

function json(status, obj){
  return {
    statusCode: status,
    headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' },
    body: JSON.stringify(obj)
  };
}

function htmlToText(html=''){
  html = html.replace(/<script[\s\S]*?<\/script>/gi,' ')
             .replace(/<style[\s\S]*?<\/style>/gi,' ')
             .replace(/<\/?[^>]+>/g,' ')
             .replace(/\s+/g,' ')
             .trim();
  return html;
}

module.exports.handler = async (event)=>{
  try{
    const qs = new URLSearchParams(event.rawQuery||'');
    const link = qs.get('link');
    if(!link) return json(400,{error:'Missing link'});

    const r = await fetchFn(link);
    if(!r.ok) throw new Error('Fetch failed '+r.status);
    const html = await r.text();
    const text = htmlToText(html);

    // Wrap in simple template
    const article = `
      <h2>Overview</h2>
      <p>${text.slice(0,2000)}</p>
      <h2>How to Apply</h2>
      <p>Please check the official website for application process.</p>
      <h2>Important Links</h2>
      <p><a href="${link}" target="_blank">Official Notification</a></p>
    `;

    return json(200,{html:article,images:[
      "https://source.unsplash.com/1024x576/?job,kolkata",
      "https://source.unsplash.com/1024x576/?career,india",
      "https://source.unsplash.com/1024x576/?office,documents"
    ]});
  }catch(e){
    return json(500,{error:e.message});
  }
};
