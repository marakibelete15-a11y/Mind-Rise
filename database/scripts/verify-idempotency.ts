import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function getCounts() {
  return {
    topics: await prisma.topic.count(),
    starterRoutines: await prisma.starterRoutine.count(),
    assessmentTemplates: await prisma.assessmentTemplate.count(),
    assessmentQuestions: await prisma.assessmentQuestion.count(),
    crisisResources: await prisma.crisisResource.count(),
    badges: await prisma.badge.count(),
    users: await prisma.user.count(),
    verifiedIdentities: await prisma.verifiedIdentity.count(),
    profiles: await prisma.profile.count(),
  };
}

async function verify() {
  console.log('🧪 [Idempotency Test] Gathering baseline row counts...');
  const countsRun1 = await getCounts();
  console.log('Baseline counts:', countsRun1);

  console.log('🔄 [Idempotency Test] Executing seed script second time...');
  execSync('npx tsx prisma/seed/seed.ts', {
    cwd: '/home/maraki/MindRiseNew/database',
    stdio: 'inherit',
    env: process.env,
  });

  console.log('📊 [Idempotency Test] Gathering row counts after second run...');
  const countsRun2 = await getCounts();
  console.log('Post-seed counts:', countsRun2);

  let passed = true;
  for (const [table, count1] of Object.entries(countsRun1)) {
    const count2 = (countsRun2 as Record<string, number>)[table];
    if (count1 !== count2) {
      console.error(`❌ Table ${table} count changed: Run 1 = ${count1}, Run 2 = ${count2}`);
      passed = false;
    } else {
      console.log(`✅ Table ${table}: ${count1} rows (unchanged)`);
    }
  }

  if (!passed) {
    throw new Error('Seed idempotency verification failed!');
  }

  console.log('🎉 [Idempotency Test] PASSED: Seed script is completely idempotent!');
}

verify()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
