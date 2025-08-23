const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fetchFn = global.fetch;

async function fetchReadable(url){
  const res = await fetchFn(url,{headers:{'User-Agent':'Mozilla/5.0 (AI-Post-Fetch)'}});
  if(!res.ok) throw new Error('Fetch failed '+res.status);
  const html = await res.text();
  const dom = new JSDOM(html,{url});
  const reader = new Readability(dom.window.document);
  const article = reader.parse()||{};
  const text=(article.textContent||'').replace(/\s+/g,' ').trim();
  return {title:article.title||'',text};
}

async function llmWriteLong(text,srcUrl){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return {html:`<p class="notice">AI key missing. Showing source summary.</p><p>${text.slice(0,1500)}</p>`,images:[]};

  const sys=`You are a helpful editor for a WB jobs site. Write an original article with H2/H3, eligibility, steps, FAQs. Length 2000-3000 words. End with disclaimer.`;
  const user=`SOURCE URL: ${srcUrl}\nSOURCE TEXT (trimmed): ${text.slice(0,12000)}`;

  const r=await fetchFn('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:sys},{role:"user",content:user}],temperature:0.4})
  });
  if(!r.ok) throw new Error('LLM error '+(await r.text()));
  const j=await r.json();
  const content=(j.choices?.[0]?.message?.content||'').trim();

  return {html:content,images:[
    "Abstract banner: Kolkata jobs, WB recruitment, city silhouette",
    "Illustration: student applying online, laptop, WB govt backdrop",
    "Infographic: eligibility checklist, documents, deadlines"
  ]};
}

module.exports.handler=async(event)=>{
  try{
    const link=new URLSearchParams(event.rawQuery||'').get('link');
    if(!link) return {statusCode:400,body:JSON.stringify({error:'Missing link'})};
    const {text,title}=await fetchReadable(link);
    if(!text) return {statusCode:200,body:JSON.stringify({title,html:'<p>No content.</p>',images:[]})};
    const out=await llmWriteLong(text,link);
    return {statusCode:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:JSON.stringify({title,...out})};
  }catch(e){return {statusCode:500,body:JSON.stringify({error:e.message})}}
};
