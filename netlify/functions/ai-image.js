const fetchFn=global.fetch;
module.exports.handler=async(event)=>{
  try{
    const prompt=new URLSearchParams(event.rawQuery||'').get('prompt')||'Kolkata skyline recruitment banner';
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey) return {statusCode:200,body:JSON.stringify({dataUrl:null,note:'OPENAI_API_KEY missing'})};
    const r=await fetchFn('https://api.openai.com/v1/images/generations',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:"gpt-image-1",prompt,size:"1024x576"})
    });
    if(!r.ok) throw new Error('Image API error '+(await r.text()));
    const j=await r.json();
    const b64=j.data?.[0]?.b64_json;
    const dataUrl=b64?`data:image/png;base64,${b64}`:null;
    return {statusCode:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:JSON.stringify({dataUrl})};
  }catch(e){return {statusCode:500,body:JSON.stringify({error:e.message})}}
};
