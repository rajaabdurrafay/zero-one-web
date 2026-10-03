import {Request,Response,NextFunction} from 'express';
import {z} from 'zod';
import {BookingStatus,ResourceType} from '@prisma/client';
import {businessInstant} from '@zeroone/domain';
const bounded=z.coerce.number().int().min(1).max(100);
export function validateQueries(req:Request,res:Response,next:NextFunction){
  try {
    if(req.query.limit!==undefined)bounded.parse(req.query.limit);
    if(req.query.page!==undefined)z.coerce.number().int().min(1).max(100000).parse(req.query.page);
    for(const key of ['date','dateFrom','dateTo','startDate','endDate'])if(req.query[key]!==undefined){const value=z.string().parse(req.query[key]);businessInstant(value);}
    if(req.path.startsWith('/api/bookings') && req.query.status!==undefined){for(const value of z.string().parse(req.query.status).split(','))z.nativeEnum(BookingStatus).parse(value.trim());}
    if(req.query.resourceType!==undefined){for(const value of z.string().parse(req.query.resourceType).split(','))z.nativeEnum(ResourceType).parse(value.trim());}
    if(req.query.search!==undefined)z.string().max(200).parse(req.query.search);
    if(req.query.sortOrder!==undefined)z.enum(['asc','desc']).parse(req.query.sortOrder);
    next();
  }catch(error){res.status(400).json({error:'Invalid query parameters',...(error instanceof z.ZodError ? {details:error.errors}:{})})}
}
