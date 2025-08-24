// netlify/functions/env-check.js
module.exports.handler = async () => {
  const has = !!process.env.OPENAI_API_KEY;
  return {
    statusCode: 200,
    headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
    body: JSON.stringify({
      ok: true,
      openai_key_present: has,
      message: has ? 'Key detected by runtime.' : 'No OPENAI_API_KEY found. Add in Site settings → Environment variables, then redeploy.'
    })
  };
};
