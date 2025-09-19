// proxy.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3001;

app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const cache = new Map();
function k(req){ return req.originalUrl; }
function get(u){ const e=cache.get(u); if(!e) return null; if(Date.now()-e.t>e.ttl){cache.delete(u);return null;} return e.v; }
function put(u,v,ttl=60_000){ cache.set(u,{t:Date.now(),ttl,v}); }

async function pass(res, r){ const txt=await r.text(); res.status(r.status); res.set("Content-Type", r.headers.get("content-type")||"application/json"); res.send(txt); }

app.get("/yahoo/quote", async (req,res)=>{
  try{
    const symbols=(req.query.symbols||"").toString().trim();
    if(!symbols) return res.status(400).json({error:"missing symbols"});
    const target=`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const ck=k(req), c=get(ck); if(c) return res.json(c);
    const r=await fetch(target,{headers:{Accept:"application/json"}});
    if(!r.ok) return pass(res,r);
    const j=await r.json(); put(ck,j,60_000); return res.json(j);
  }catch(e){ res.status(502).json({error:String(e)}); }
});

app.get("/yahoo/chart", async (req,res)=>{
  try{
    const s=(req.query.symbol||"").toString().trim();
    const range=(req.query.range||"1d").toString();
    const interval=(req.query.interval||"5m").toString();
    if(!s) return res.status(400).json({error:"missing symbol"});
    const target=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    const ck=k(req), c=get(ck); if(c) return res.json(c);
    const r=await fetch(target,{headers:{Accept:"application/json"}});
    if(!r.ok) return pass(res,r);
    const j=await r.json(); put(ck,j,60_000); return res.json(j);
  }catch(e){ res.status(502).json({error:String(e)}); }
});

app.get("/fx/latest", async (req,res)=>{
  try{
    const base=(req.query.base||"USD").toString();
    const symbols=(req.query.symbols||"").toString().replace(/:.*$/g,"");
    const qs=new URLSearchParams({base,places:"6"});
    if(symbols) qs.set("symbols", symbols);
    const target=`https://api.exchangerate.host/latest?${qs.toString()}`;
    const ck=k(req), c=get(ck); if(c) return res.json(c);
    const r=await fetch(target,{headers:{Accept:"application/json"}});
    if(!r.ok) return pass(res,r);
    const j=await r.json(); put(ck,j,60_000); return res.json(j);
  }catch(e){ res.status(502).json({error:String(e)}); }
});

app.listen(3001, ()=> console.log("Proxy on http://localhost:3001"));
