import {Request,Response,NextFunction} from 'express';
// Per-process bounded cache: invalidated on every successful API mutation.
// Only these exact public catalog routes can enter the cache; never booking/auth/payment data.
const routes=new Set(['/api/pricing','/api/theme','/api/public-settings','/api/system-settings','/api/popup-settings','/api/offers/active','/api/gallery','/api/reels','/api/reviews']);
const entries=new Map<string,{expires:number;body:unknown}>();
export function publicCache(req:Request,res:Response,next:NextFunction){
  if(!['GET','HEAD'].includes(req.method)){res.once('finish',()=>{if(res.statusCode<400)entries.clear()});return next();}
  // Admin-specific query variants and authenticated reads never share public entries.
  const path=req.originalUrl.split('?')[0].replace(/\/$/,'');
  if(!routes.has(path) || req.headers.authorization || req.headers['x-admin-token'] || req.query.all || req.query.target==='ADMIN' || res.locals.apiVersion)return next();
  const key=req.originalUrl;
  const cached=entries.get(key);if(cached && cached.expires>Date.now())return res.json(cached.body);
  const json=res.json.bind(res);
  res.json=(body:unknown)=>{if(res.statusCode===200){if(entries.size>=100)entries.clear();entries.set(key,{expires:Date.now()+10000,body})}return json(body)};
  next();
}
