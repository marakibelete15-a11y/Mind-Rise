import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, normalizeEmail } from '../src/utils/normalize.js';
import { parsePagination, paginate } from '../src/utils/pagination.js';
import { encrypt, decrypt, encryptJson, decryptJson } from '../src/utils/crypto.js';
import { AppError, errorHandler } from '../src/middleware/errorHandler.js';
import { z } from 'zod';
import { requireActive, requireRole } from '../src/middleware/auth.js';
import { AccountStatus, UserRole } from '@mindrise/database';

test('crypto round trip, JSON and tamper detection',()=>{const value=encrypt('private');assert.equal(decrypt(value),'private');assert.deepEqual(decryptJson(encryptJson({a:1})),{a:1});const b=Buffer.from(value.slice(7),'base64');b[b.length-1]^=1;assert.throws(()=>decrypt('enc_v1:'+b.toString('base64')));});
test('phone and email normalization',()=>{for(const raw of ['0911000000','911000000','0711000000','251911000000','+251911000000'])assert.equal(normalizePhone(raw),'+251911000000');assert.equal(normalizeEmail('  A@EXAMPLE.COM '),'a@example.com');assert.throws(()=>normalizePhone('123'));});
test('pagination defaults, bounds, cursor and next cursor',()=>{assert.deepEqual(parsePagination({}),{cursor:undefined,limit:20});assert.deepEqual(parsePagination({cursor:'abc',limit:'100'}),{cursor:'abc',limit:50});assert.deepEqual(paginate([{id:'1'},{id:'2'},{id:'3'}],2),{items:[{id:'1'},{id:'2'}],nextCursor:'2'});});
test('role and active middleware enforce roles and every status',()=>{const invoke=(fn:any,user:any)=>{let error:any;fn({user},{},(e:any)=>error=e);return error};assert.equal(invoke(requireRole(UserRole.ADMIN),{id:'1',role:UserRole.USER,status:AccountStatus.ACTIVE}).code,'FORBIDDEN');assert.equal(invoke(requireRole(UserRole.ADMIN),{id:'1',role:UserRole.ADMIN,status:AccountStatus.ACTIVE}),undefined);for(const status of Object.values(AccountStatus)){const e=invoke(requireActive,{id:'1',role:UserRole.USER,status});assert.equal(status===AccountStatus.ACTIVE?e===undefined:e.code==='ACCOUNT_RESTRICTED',true);}});
test('error handler emits AppError, ZodError, and production generic unknown shape',()=>{const run=(e:any,production=false)=>{let result:any;let status=0;process.env.NODE_ENV=production?'production':'test';errorHandler(e,{} as any,{status(n:number){status=n;return this},json(x:any){result=x;return this}} as any,(()=>{}) as any);return {status,result}};assert.deepEqual(run(new AppError(403,'NO','Denied')).result,{error:{code:'NO',message:'Denied'}});assert.equal(run(z.object({a:z.string()}).safeParse({a:1}).error).status,400);assert.deepEqual(run(new Error('secret stack'),true).result,{error:{code:'INTERNAL_ERROR',message:'An unexpected error occurred.'}});});
