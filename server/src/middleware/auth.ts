import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AccountStatus, UserRole } from '@mindrise/database';
import prisma from '@mindrise/database';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';
export type AuthUserPayload={id:string;role:UserRole;status:AccountStatus};
declare global { namespace Express { interface Request { user?: AuthUserPayload } } }
const unauthorized=(res:Response)=>res.status(401).json({error:{code:'INVALID_TOKEN',message:'Token is missing or invalid.'}});
export const authenticate:RequestHandler=async(req:Request,res:Response,next:NextFunction)=>{
 try {
  if(config.env==='development'&&typeof req.headers['x-dev-user-id']==='string') { // Remove this development-only stub once real login is merged.
   const user=await prisma.user.findUnique({where:{id:req.headers['x-dev-user-id']},select:{id:true,role:true,status:true,deletedAt:true}}); if(!user||user.deletedAt) return unauthorized(res); req.user={id:user.id,role:user.role,status:user.status}; return next();
  }
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]; if(!token||!config.jwt.secret) return unauthorized(res);
  const decoded=jwt.verify(token,config.jwt.secret); if(typeof decoded==='string'||typeof decoded.id!=='string') return unauthorized(res);
  const user=await prisma.user.findUnique({where:{id:decoded.id},select:{id:true,role:true,status:true,deletedAt:true}}); if(!user||user.deletedAt)return unauthorized(res);
  req.user={id:user.id,role:user.role,status:user.status}; return next();
 } catch { return unauthorized(res); }
};
export const requireRole=(...roles:UserRole[]):RequestHandler=>(req,_res,next)=>{if(!req.user)return next(new AppError(401,'INVALID_TOKEN','Authentication required.')); if(!roles.includes(req.user.role))return next(new AppError(403,'FORBIDDEN','Insufficient role.')); next();};
export const requireActive:RequestHandler=(req,_res,next)=>req.user?.status===AccountStatus.ACTIVE?next():next(new AppError(403,'ACCOUNT_RESTRICTED','This account is restricted.'));
