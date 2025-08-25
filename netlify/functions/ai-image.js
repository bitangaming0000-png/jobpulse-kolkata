// netlify/functions/ai-image.js (free Unsplash proxy)
module.exports.handler = async (event)=>{
  try{
    const qs = new URLSearchParams(event.rawQuery||'');
    const prompt = qs.get('prompt') || 'job,kolkata';
    // Unsplash random free image
    const url = `https://source.unsplash.com/1024x576/?${encodeURIComponent(prompt)}`;
    return {
      statusCode:200,
      headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},
      body: JSON.stringify({dataUrl:url})
    };
  }catch(e){
    return {statusCode:500,body:JSON.stringify({error:e.message})};
  }
};
