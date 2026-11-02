import { PrismaClient, UserRole, AccountStatus, Language } from '@mindrise/database';
import { encrypt, hmacHash } from '../src/utils/crypto.js';
if (process.env.NODE_ENV === 'production') throw new Error('Dev users cannot be seeded in production.');
const prisma=new PrismaClient();
const moderatorId='00000000-0000-4000-a000-000000000001';
const people=[
{id:'00000000-0000-4000-a000-000000000011',handle:'DevUserOne',role:UserRole.USER,status:AccountStatus.ACTIVE,phone:'+251911000011'},
{id:'00000000-0000-4000-a000-000000000012',handle:'DevUserTwo',role:UserRole.USER,status:AccountStatus.ACTIVE,phone:'+251911000012'},
{id:moderatorId,handle:'DevModerator',role:UserRole.MODERATOR,status:AccountStatus.ACTIVE,phone:'+251911000000'},
{id:'00000000-0000-4000-a000-000000000013',handle:'DevRestricted',role:UserRole.USER,status:AccountStatus.RESTRICTED,phone:'+251911000013'}];
async function main(){for(const person of people){const user=await prisma.user.upsert({where:{id:person.id},update:{role:person.role,status:person.status,preferredLanguage:Language.AM},create:{id:person.id,role:person.role,status:person.status,preferredLanguage:Language.AM}}); await prisma.profile.upsert({where:{userId:user.id},update:{anonymousHandle:person.handle},create:{userId:user.id,anonymousHandle:person.handle}}); await prisma.verifiedIdentity.upsert({where:{userId:user.id},update:{firstName:'Development',lastName:'User',phoneEncrypted:encrypt(person.phone),emailEncrypted:null,phoneHash:hmacHash(person.phone),emailHash:null,verifiedAt:new Date()},create:{userId:user.id,firstName:'Development',lastName:'User',phoneEncrypted:encrypt(person.phone),phoneHash:hmacHash(person.phone),verifiedAt:new Date()}});} console.log('Development user IDs for x-dev-user-id:'); for(const p of people) console.log(`${p.handle}: ${p.id}`);}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
