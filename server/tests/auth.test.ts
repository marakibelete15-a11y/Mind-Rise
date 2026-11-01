import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import prisma from '@mindrise/database';
import { authenticate } from '../src/middleware/auth.js';
import { config } from '../src/config/index.js';
import { AccountStatus, UserRole } from '@mindrise/database';

function invoke(headers:Record<string,string>,env='test') { process.env.NODE_ENV=env; let error:any; let called=false; let status=0; let body:any; const req:any={headers}; const res:any={status(n:number){status=n;return this},json(x:any){body=x;return this}}; authenticate(req,res,(e:any)=>{error=e;called=true}).catch((e:any)=>{error=e}); return {req,get status(){return status},get body(){return body},get called(){return called},get error(){return error}}; }
test('authenticate rejects missing and malformed tokens',async()=>{for(const headers of [{},{authorization:'Bearer bad'}]){const out=invoke(headers);await new Promise(r=>setImmediate(r));assert.equal(out.status,401);}});
test('authenticate loads current safe user fields for valid token',async()=>{const original=prisma.user.findUnique; (prisma.user as any).findUnique=async()=>({id:'u1',role:UserRole.USER,status:AccountStatus.ACTIVE,deletedAt:null}); try{const token=jwt.sign({id:'u1'},config.jwt.secret);const out=invoke({authorization:'Bearer '+token});await new Promise(r=>setImmediate(r));assert.equal(out.called,true);assert.deepEqual(out.req.user,{id:'u1',role:UserRole.USER,status:AccountStatus.ACTIVE});}finally{(prisma.user as any).findUnique=original;}});
test('dev header works only in development',async()=>{const original=prisma.user.findUnique;(prisma.user as any).findUnique=async()=>({id:'u1',role:UserRole.USER,status:AccountStatus.ACTIVE,deletedAt:null});try{const dev=invoke({'x-dev-user-id':'u1'},'development');await new Promise(r=>setImmediate(r));assert.equal(dev.called,true);const testEnv=invoke({'x-dev-user-id':'u1'},'test');await new Promise(r=>setImmediate(r));assert.equal(testEnv.status,401);}finally{(prisma.user as any).findUnique=original;}});
