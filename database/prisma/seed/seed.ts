import crypto from 'crypto';
import { PrismaClient, AssessmentDomain, UserRole, AccountStatus, Language } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [MindRise Seed] Starting database seeding (idempotent)...');

  // ===========================================================================
  // 1. TOPIC SPACES (BILINGUAL)
  // ===========================================================================
  console.log('📝 Seeding Community Topics...');
  const topics = [
    {
      slug: 'job-search-unemployment',
      nameEn: 'Job Search & Unemployment',
      nameAm: 'ሥራ ፍለጋ እና ሥራ አጥነት',
      descriptionEn:
        'A safe space to discuss career uncertainty, job-hunting burnout, and professional resilience.',
      descriptionAm: 'ስለ ሥራ ዕድሎች፣ የስራ ፍለጋ ድካም እና ሙያዊ ጥንካሬ በነጻነት የምንወያይበት መድረክ።',
    },
    {
      slug: 'academic-pressure',
      nameEn: 'Academic Pressure',
      nameAm: 'የትምህርት ጫና',
      descriptionEn:
        'Peer support for university exams, thesis deadlines, and academic performance anxiety.',
      descriptionAm: 'የዩኒቨርሲቲ ፈተናዎችን፣ የምርምር ፅሁፎችን እና የትምህርት ጭንቀቶችን በጋራ የምንጋፈራበት መድረክ።',
    },
    {
      slug: 'general-wellbeing',
      nameEn: 'General Well-being',
      nameAm: 'አጠቃላይ ደህንነት እና ጤናማ አኗኗር',
      descriptionEn:
        'Daily mindfulness, emotional check-ins, sleep hygiene, and overall lifestyle balance.',
      descriptionAm: 'የዕለት ተዕለት የአእምሮ ሰላም፣ የስሜት ክትትል፣ የእንቅልፍ ጤና እና ጤናማ የአኗኗር ዘይቤ ሚዛን።',
    },
  ];

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        nameEn: topic.nameEn,
        nameAm: topic.nameAm,
        descriptionEn: topic.descriptionEn,
        descriptionAm: topic.descriptionAm,
      },
      create: topic,
    });
  }

  // ===========================================================================
  // 2. STARTER ROUTINES (5 to 8 BILINGUAL ROUTINES)
  // ===========================================================================
  console.log('🌱 Seeding Starter Routines...');
  const starterRoutines = [
    {
      titleEn: 'Mindful Morning Walk',
      titleAm: 'የጠዋት ንቁ የእግር ጉዞ',
      descriptionEn:
        'Take a calm 10-minute walk outside without phone distractions to clear your head.',
      descriptionAm: 'አእምሮዎን ለማደስ ስልክ ሳይጠቀሙ ለ10 ደቂቃ በእግር ንጹህ አየር ይውሰዱ።',
      category: 'PHYSICAL_WELLBEING',
    },
    {
      titleEn: '4-7-8 Calming Breath',
      titleAm: 'የ4-7-8 የትንፋሽ ማረጋጊያ ልምምድ',
      descriptionEn:
        'Inhale for 4s, hold for 7s, exhale slowly for 8s. Repeat 4 cycles during stress.',
      descriptionAm: 'ለ4 ሰከንድ ወደ ውስጥ ይተንፍሱ፣ ለ7 ሰከንድ ይያዙ፣ ለ8 ሰከንድ ቀስ ብለው ያስወጡ። 4 ጊዜ ይድገሙት።',
      category: 'MINDFULNESS',
    },
    {
      titleEn: 'Gratitude Reflection (3 Things)',
      titleAm: 'የዕለታዊ ምስጋና ማስታወሻ (3 ነገሮች)',
      descriptionEn: 'Write down 3 small moments or blessings you felt grateful for today.',
      descriptionAm: 'በዛሬው ዕለት ያመሰገኑባቸውን 3 ትናንሽ መልካም አጋጣሚዎች በማስታወሻዎ ላይ ይጻፉ።',
      category: 'MINDFULNESS',
    },
    {
      titleEn: 'Hydration Reset',
      titleAm: 'የውሃ መጠጣት ልማድ',
      descriptionEn: 'Drink a full glass of clean water upon waking to rehydrate your brain.',
      descriptionAm: 'እንደነቁ አእምሮዎ እና ሰውነትዎ እንዲነቃቃ አንድ ሙሉ ብርጭቆ ንጹህ ውሃ ይጠጡ።',
      category: 'PHYSICAL_WELLBEING',
    },
    {
      titleEn: 'Focused 25-Min Study / Work Sprint',
      titleAm: 'የ25-ደቂቃ የትኩረት ስራ / የትምህርት ክፍለ ጊዜ',
      descriptionEn: 'Set a 25-minute timer to tackle one key task without switching browser tabs.',
      descriptionAm: 'የ25 ደቂቃ ሰዓት በመሙላት ያለምንም መዘናጋት አንድ ወሳኝ ስራ ወይም ትምህርት ላይ ብቻ ያተኩሩ።',
      category: 'PRODUCTIVITY',
    },
    {
      titleEn: 'Evening Screen Wind-down',
      titleAm: 'የምሽት ስክሪን እረፍት',
      descriptionEn: 'Turn off social media feeds 30 minutes before bed to protect your sleep.',
      descriptionAm: 'ጥሩ እና የተረጋጋ እንቅልፍ እንዲኖርዎት ከመተኛትዎ 30 ደቂቃ በፊት ስልክዎን ያጥፉ።',
      category: 'SLEEP_HYGIENE',
    },
    {
      titleEn: 'Midday Emotion Check-in',
      titleAm: 'የቀትር የስሜት ራስን መፈተሽ',
      descriptionEn:
        'Pause for 1 minute and name what you are feeling: tired, anxious, hopeful, or overwhelmed.',
      descriptionAm: 'ለአንድ ደቂቃ እረፍት በማድረግ አሁን የሚሰማዎትን ስሜት ይለዩ፡ ድካም፣ ጭንቀት፣ ተስፋ ወይም ጫና።',
      category: 'EMOTIONAL_HEALTH',
    },
  ];

  for (const sr of starterRoutines) {
    // Upsert using composite or query by titleEn
    const existing = await prisma.starterRoutine.findFirst({
      where: { titleEn: sr.titleEn },
    });
    if (existing) {
      await prisma.starterRoutine.update({
        where: { id: existing.id },
        data: sr,
      });
    } else {
      await prisma.starterRoutine.create({
        data: sr,
      });
    }
  }

  // ===========================================================================
  // 3. ASSESSMENT TEMPLATES & PLACEHOLDER QUESTIONS
  // NOTE: PLACEHOLDER ONLY based on standard screening patterns.
  // Formal psychiatric and clinical validation by licensed Ethiopian mental health
  // professionals is required before production release (SRS 1.2, 3.2, 6.3).
  // ===========================================================================
  console.log('📋 Seeding Assessment Templates and Placeholder Questions...');
  const assessmentTemplatesData = [
    {
      domain: AssessmentDomain.STRESS,
      titleEn: 'Stress & Overwhelm Checkup',
      titleAm: 'የጭንቀት እና የከፍተኛ ጫና ምዘና',
      descriptionEn:
        'Confidential self-assessment to gauge current stress loads and emotional exhaustion.',
      descriptionAm: 'የወቅቱን የጭንቀት መጠን እና የስሜት ድካም ለመረዳት የሚያግዝ ሚስጥራዊ የራስ ምዘና።',
      version: 1,
      riskThreshold: 10,
      questions: [
        {
          order: 1,
          textEn:
            'Over the last 2 weeks, how often have you felt unable to control important things in your life?',
          textAm: 'ባለፉት 2 ሳምንታት ውስጥ፣ በህይወትዎ ውስጥ ያሉ አስፈላጊ ነገሮችን መቆጣጠር እንዳልቻሉ ምን ያህል ተሰምቶዎታል?',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 2,
          textEn: 'How often have you felt confident in your ability to handle personal problems?',
          textAm: 'የግል ችግሮችዎን የመፍታት አቅም እንዳለዎት በራስ የመተማመን ስሜት ምን ያህል ተሰምቶዎታል?',
          isRiskItem: false,
          scoring: { always: 0, often: 1, sometimes: 2, rarely: 3 },
        },
        {
          order: 3,
          textEn:
            'How often have you felt difficulties were piling up so high that you could not overcome them?',
          textAm: 'ችግሮች በጣም ተደራርበው መወጣት እንደማይችሉ ሆኖ የተሰማዎት ጊዜ ምን ያህል ነው?',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 4,
          textEn:
            'Have you felt so overwhelmed that you felt hopeless about your immediate future?',
          textAm: 'ከፍተኛ ጫና ተሰምቷችሁ ስለ ቀጣዩ ህይወትዎ ሙሉ በሙሉ ተስፋ የመቁረጥ ስሜት አጋጥሟችሁ ያውቃል?',
          isRiskItem: true,
          scoring: { never: 0, rarely: 1, sometimes: 2, frequently: 4 },
        },
      ],
    },
    {
      domain: AssessmentDomain.ANXIETY,
      titleEn: 'Anxiety & Worry Scale',
      titleAm: 'የስጋት እና የጭንቀት መጠን መለኪያ',
      descriptionEn: 'Helps identify patterns of persistent worry, nervousness, and tension.',
      descriptionAm: 'ቀጣይነት ያለው ስጋት፣ የነርቭ መረበሽ እና የጭንቀት ምልክቶችን ለመለየት ይረዳል።',
      version: 1,
      riskThreshold: 10,
      questions: [
        {
          order: 1,
          textEn: 'Feeling nervous, anxious, or on edge over the past 2 weeks.',
          textAm: 'ባለፉት 2 ሳምንታት የመረበሽ፣ የስጋት ወይም የፍርሀት ስሜት መሰማት።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 2,
          textEn: 'Not being able to stop or control worrying.',
          textAm: 'ጭንቀትን እና ስጋትን ማቆም ወይም መቆጣጠር አለመቻል።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 3,
          textEn: 'Trouble relaxing or resting your mind.',
          textAm: 'አእምሮን ዘና ለማድረግ ወይም ለማሳረፍ መቸገር።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 4,
          textEn: 'Feeling afraid, as if something awful might happen suddenly.',
          textAm: 'ድንገት አስፈሪ ወይም መጥፎ ነገር ሊከሰት እንደሚችል በማሰብ ከፍተኛ ፍርሀት መሰማት።',
          isRiskItem: true,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 4 },
        },
      ],
    },
    {
      domain: AssessmentDomain.LOW_MOTIVATION,
      titleEn: 'Energy & Drive Checkup',
      titleAm: 'የብርታት እና የተነሳሽነት ምዘና',
      descriptionEn: 'Assesses loss of interest, lethargy, and difficulties starting daily tasks.',
      descriptionAm: 'የስራ ፍላጎት ማጣትን፣ ድካምን እና ዕለታዊ ተግባራትን ለመጀመር መቸገርን ይገመግማል።',
      version: 1,
      riskThreshold: 9,
      questions: [
        {
          order: 1,
          textEn: 'Little interest or pleasure in doing everyday activities.',
          textAm: 'በዕለት ተዕለት ተግባራት ላይ ፍላጎት ወይም ደስታ ማጣት።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 2,
          textEn: 'Feeling tired or having very little energy to begin work.',
          textAm: 'ስራ ለመጀመር ከፍተኛ የድካም ስሜት ወይም ጉልበት ማጣት መሰማት።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 3,
          textEn: 'Procrastinating or putting off critical tasks because of feeling depleted.',
          textAm: 'ጉልበት በማጣት ምክንያት አስፈላጊ የሆኑ ስራዎችን ማዘግየት ወይም መተው።',
          isRiskItem: false,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 3 },
        },
        {
          order: 4,
          textEn: 'Feeling that trying to improve things is completely futile.',
          textAm: 'ነገሮችን ለማስተካከል መሞከር ምንም ጥቅም እንደሌለው ሆኖ መሰማት።',
          isRiskItem: true,
          scoring: { notAtAll: 0, severalDays: 1, overHalfDays: 2, nearlyEveryDay: 4 },
        },
      ],
    },
    {
      domain: AssessmentDomain.EMOTIONAL_EXHAUSTION,
      titleEn: 'Burnout & Emotional Fatigue',
      titleAm: 'የስሜት መሟጠጥ እና ከፍተኛ ድካም',
      descriptionEn: 'Screening for prolonged mental drain and emotional depletion.',
      descriptionAm: 'የረጅም ጊዜ የአእምሮ ዝለት እና የስሜት ድካም ምልክቶችን ለመፈተሽ።',
      version: 1,
      riskThreshold: 10,
      questions: [
        {
          order: 1,
          textEn: 'Feeling emotionally drained from your daily routine or job hunt.',
          textAm: 'ከዕለታዊ ልማድ ወይም ከስራ ፍለጋ የተነሳ ስሜታዊ ዝለት መሰማት።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 2,
          textEn: 'Feeling used up at the end of the day with nothing left to give.',
          textAm: 'ቀኑ ሲጠናቀቅ ምንም የቀረ ጉልበት ወይም ስሜት እንደሌለ ሆኖ መሰማት።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 3,
          textEn: 'Feeling frustrated by circumstances beyond your personal control.',
          textAm: 'ከአቅም በላይ በሆኑ ሁኔታዎች ምክንያት ከፍተኛ ብስጭት መሰማት።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 4,
          textEn: 'Feeling completely detached or numb toward people around you.',
          textAm: 'በአካባቢዎ ካሉ ሰዎች ጋር ምንም አይነት ስሜት እንደሌለዎት እና መገለል መሰማት።',
          isRiskItem: true,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 4 },
        },
      ],
    },
    {
      domain: AssessmentDomain.LOSS_OF_PURPOSE,
      titleEn: 'Direction & Meaning Scale',
      titleAm: 'የዓላማ እና የህይወት አቅጣጫ መለኪያ',
      descriptionEn: 'Understands feelings of aimlessness during career or transition stages.',
      descriptionAm: 'በሽግግር ወይም በስራ ፍለጋ ወቅት የሚከሰት የአቅጣጫ እና የዓላማ ማጣት ስሜት።',
      version: 1,
      riskThreshold: 10,
      questions: [
        {
          order: 1,
          textEn: 'Feeling uncertain about what direction your life is heading.',
          textAm: 'ህይወትዎ ወደ የትኛው አቅጣጫ እየሄደ እንደሆነ እርግጠኛ አለመሆን።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 2,
          textEn: 'Finding it difficult to identify meaningful goals for this month.',
          textAm: 'ለዚህ ወር ትርጉም ያለው ግብ ለማውጣት መቸገር።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 3,
          textEn: 'Feeling like your peers are progressing while you are falling behind.',
          textAm: 'እኩዮችዎ ወደፊት ሲራመዱ እርስዎ ወደ ኋላ የቀሩ መስሎ መሰማት።',
          isRiskItem: false,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
        },
        {
          order: 4,
          textEn: 'Questioning whether your daily efforts have any value at all.',
          textAm: 'የዕለት ተዕለት ጥረቶችዎ ምንም ዓይነት ዋጋ እንዳላቸው መጠራጠር።',
          isRiskItem: true,
          scoring: { rarely: 0, sometimes: 1, often: 2, always: 4 },
        },
      ],
    },
  ];

  for (const templateData of assessmentTemplatesData) {
    const { questions, ...templateFields } = templateData;
    const template = await prisma.assessmentTemplate.upsert({
      where: {
        domain_version: {
          domain: templateFields.domain,
          version: templateFields.version,
        },
      },
      update: templateFields,
      create: templateFields,
    });

    for (const q of questions) {
      const existingQ = await prisma.assessmentQuestion.findFirst({
        where: { templateId: template.id, order: q.order },
      });
      if (existingQ) {
        await prisma.assessmentQuestion.update({
          where: { id: existingQ.id },
          data: {
            textEn: q.textEn,
            textAm: q.textAm,
            isRiskItem: q.isRiskItem,
            scoring: q.scoring,
          },
        });
      } else {
        await prisma.assessmentQuestion.create({
          data: {
            templateId: template.id,
            ...q,
          },
        });
      }
    }
  }

  // ===========================================================================
  // 4. CRISIS RESOURCES (SRS 3.6)
  // CRITICAL REQUIREMENT: lastVerifiedAt = null
  // TODO: VERIFY BEFORE LAUNCH (SRS 3.6). Do not present numbers as confirmed.
  // ===========================================================================
  console.log('🚨 Seeding Crisis Resources (Unverified placeholders)...');
  const crisisResources = [
    {
      nameEn: 'Amanuel Mental Specialized Hospital Helpline',
      nameAm: 'አማኑኤል አዕምሮ ስፔሻላይዝድ ሆስፒታል የእርዳታ መስመር',
      descriptionEn: 'National public mental health specialized support hotline in Ethiopia.',
      descriptionAm: 'በኢትዮጵያ ውስጥ ብሔራዊ የህዝብ የአእምሮ ጤና ድጋፍ መስመር።',
      phone: '8335',
      isActive: true,
      lastVerifiedAt: null, // TODO: VERIFY BEFORE LAUNCH (SRS 3.6)
    },
    {
      nameEn: 'National Emergency Medical Assistance',
      nameAm: 'ብሔራዊ የአስቸኳይ ጊዜ የህክምና እርዳታ',
      descriptionEn: 'Ethiopian emergency medical response services for acute health crises.',
      descriptionAm: 'ለአስቸኳይ የጤና ችግሮች የኢትዮጵያ አስቸኳይ የህክምና ምላሽ አገልግሎት።',
      phone: '952',
      isActive: true,
      lastVerifiedAt: null, // TODO: VERIFY BEFORE LAUNCH (SRS 3.6)
    },
  ];

  for (const cr of crisisResources) {
    const existing = await prisma.crisisResource.findFirst({
      where: { phone: cr.phone },
    });
    if (existing) {
      await prisma.crisisResource.update({
        where: { id: existing.id },
        data: cr,
      });
    } else {
      await prisma.crisisResource.create({
        data: cr,
      });
    }
  }

  // ===========================================================================
  // 5. GAMIFICATION BADGES
  // ===========================================================================
  console.log('🏆 Seeding Gamification Badges...');
  const badges = [
    {
      slug: 'first-routine',
      nameEn: 'First Step',
      nameAm: 'የመጀመሪያ እርምጃ',
      descriptionEn: 'Completed your very first daily routine.',
      descriptionAm: 'የመጀመሪያውን ዕለታዊ ልማድ በተሳካ ሁኔታ አጠናቀዋል።',
      pointsRequired: 10,
    },
    {
      slug: 'streak-3',
      nameEn: '3-Day Consistency',
      nameAm: 'የ3-ቀን ፅናት',
      descriptionEn: 'Maintained a routine streak for 3 consecutive days.',
      descriptionAm: 'ለ3 ተከታታይ ቀናት ዕለታዊ ልማዶችን ጠብቀዋል።',
      pointsRequired: 50,
    },
    {
      slug: 'streak-7',
      nameEn: 'Weekly Champion',
      nameAm: 'የሳምንት ሻምፒዮን',
      descriptionEn: 'Maintained an unbroken 7-day routine streak.',
      descriptionAm: 'ለአንድ ሙሉ ሳምንት (7 ቀናት) ያለማቋረጥ ልማዶችን አከናውነዋል።',
      pointsRequired: 150,
    },
    {
      slug: 'assessment-explorer',
      nameEn: 'Self-Awareness Pioneer',
      nameAm: 'የራስ ግንዛቤ ፈርጥ',
      descriptionEn: 'Completed your first structured well-being assessment.',
      descriptionAm: 'የመጀመሪያውን የአእምሮ ጤና እና የደህንነት ምዘና አጠናቀዋል።',
      pointsRequired: 30,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge,
    });
  }

  // ===========================================================================
  // 6. DEV-ONLY MODERATOR ACCOUNT
  // Guarded so it NEVER runs in production!
  // ===========================================================================
  if (process.env.NODE_ENV === 'production') {
    console.log(
      '🔒 Production environment detected: Skipping dev-only moderator account creation.',
    );
  } else {
    console.log('🛡️ Seeding Dev-Only Moderator Account...');
    const devModUserId = '00000000-0000-4000-a000-000000000001';

    const user = await prisma.user.upsert({
      where: { id: devModUserId },
      update: {
        role: UserRole.MODERATOR,
        status: AccountStatus.ACTIVE,
        preferredLanguage: Language.EN,
      },
      create: {
        id: devModUserId,
        role: UserRole.MODERATOR,
        status: AccountStatus.ACTIVE,
        preferredLanguage: Language.EN,
      },
    });

    // Normalized phone format: +251XXXXXXXXX (SRS FR-1.1, FR-1.5)
    const devPhoneNormalized = '+251911000000';
    const devEmailNormalized = 'dev-moderator@mindrise.local';
    const pepper = process.env.HASH_PEPPER || 'dev_pepper_placeholder_min_32_characters_for_hmac';
    const phoneHash = crypto.createHmac('sha256', pepper).update(devPhoneNormalized).digest('hex');
    const emailHash = crypto.createHmac('sha256', pepper).update(devEmailNormalized).digest('hex');

    await prisma.verifiedIdentity.upsert({
      where: { userId: user.id },
      update: {
        firstName: 'Dev',
        lastName: 'Moderator',
        phoneEncrypted: 'enc_v1:' + Buffer.from(devPhoneNormalized).toString('base64'),
        emailEncrypted: 'enc_v1:' + Buffer.from(devEmailNormalized).toString('base64'),
        phoneHash,
        emailHash,
        verifiedAt: new Date(),
      },
      create: {
        userId: user.id,
        firstName: 'Dev',
        lastName: 'Moderator',
        phoneEncrypted: 'enc_v1:' + Buffer.from(devPhoneNormalized).toString('base64'),
        emailEncrypted: 'enc_v1:' + Buffer.from(devEmailNormalized).toString('base64'),
        phoneHash,
        emailHash,
        verifiedAt: new Date(),
      },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        anonymousHandle: 'DevModerator',
        bio: 'Development seed moderator account for content and safety queues.',
      },
      create: {
        userId: user.id,
        anonymousHandle: 'DevModerator',
        bio: 'Development seed moderator account for content and safety queues.',
      },
    });

    console.log(`✅ Dev-only moderator seeded: Handle "DevModerator" (ID: ${user.id})`);
  }

  console.log('✨ [MindRise Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ [MindRise Seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
