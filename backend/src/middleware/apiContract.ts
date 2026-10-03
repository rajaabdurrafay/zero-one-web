import {Request,Response,NextFunction} from 'express';
import {z} from 'zod';
export function versionedApi(req:Request,res:Response,next:NextFunction){
  if(!/^\/api\/v1(?:\/|\?|$)/.test(req.url))return next();
  res.locals.apiVersion=1;
  res.setHeader('X-API-Version','1');
  const json=res.json.bind(res);
  res.json=(body:any)=>{
    if(res.statusCode>=400)return json({success:false,error:{code:res.statusCode===400?'VALIDATION_ERROR':res.statusCode===401?'UNAUTHENTICATED':res.statusCode===403?'FORBIDDEN':res.statusCode===404?'NOT_FOUND':res.statusCode===409?'CONFLICT':res.statusCode===429?'RATE_LIMITED':'REQUEST_FAILED',message:typeof body?.error==='string'?body.error:body?.message || 'Request failed',...(body?.details ? {details:body.details}:{})}});
    return json({success:true,data:body,...(res.locals.pagination ? {meta:{pagination:res.locals.pagination}}:{})});
  };
  req.url=req.url.replace(/^\/api\/v1/,'/api');next();
}
export function pagination(req:Request,res:Response){
  const schema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(50)});
  const values=schema.parse(req.query);
  const requested=Boolean(res.locals.apiVersion || req.query.page!==undefined || req.query.limit!==undefined);
  return {...values,requested,skip:(values.page-1)*values.limit};
}
export function pageResult(res:Response,total:number,page:number,limit:number){
  res.locals.pagination={total,page,limit,totalPages:Math.ceil(total/limit)};
  res.setHeader('X-Total-Count',String(total));res.setHeader('X-Page',String(page));res.setHeader('X-Page-Limit',String(limit));
}
