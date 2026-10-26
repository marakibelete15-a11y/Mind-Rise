/**
 * MindRise Database Seeding Script (Placeholder)
 * Seeds initial crisis hotline resources, routine templates, and moderation presets.
 */

export interface CrisisResourceSeed {
  name: string;
  nameAm: string;
  phone: string;
  description: string;
  descriptionAm: string;
  availableHours: string;
}

export const INITIAL_CRISIS_RESOURCES: CrisisResourceSeed[] = [
  {
    name: 'Amanuel Mental Specialized Hospital Helpline',
    nameAm: 'አማኑኤል አዕምሮ ስፔሻላይዝድ ሆስፒታል የእርዳታ መስመር',
    phone: '8335',
    description: 'National public mental health specialized support hotline in Ethiopia.',
    descriptionAm: 'በኢትዮጵያ ውስጥ ብሔራዊ የህዝብ የአእምሮ ጤና ድጋፍ መስመር።',
    availableHours: '24/7',
  },
  {
    name: 'National Emergency Medical Assistance',
    nameAm: 'ብሔራዊ የአስቸኳይ ጊዜ የህክምና እርዳታ',
    phone: '952',
    description: 'Ethiopian emergency medical response services for acute health crises.',
    descriptionAm: 'ለአስቸኳይ የጤና ችግሮች የኢትዮጵያ አስቸኳይ የህክምና ምላሽ አገልግሎት።',
    availableHours: '24/7',
  },
];

export const INITIAL_ROUTINE_TEMPLATES = [
  {
    titleEn: '10-Minute Morning Mindful Walk',
    titleAm: 'የ10 ደቂቃ የጠዋት የእግር ጉዞ',
    category: 'PHYSICAL_WELLBEING',
  },
  {
    titleEn: 'Gratitude Reflection (3 Things)',
    titleAm: 'የምስጋና ማስታወሻ (3 ነገሮች)',
    category: 'MINDFULNESS',
  },
  {
    titleEn: 'Focused Study / Work Block',
    titleAm: 'የትኩረት ስራ / የትምህርት ክፍለ ጊዜ',
    category: 'PRODUCTIVITY',
  },
];

async function main() {
  console.log('🌱 [MindRise Seed] Placeholder seed script initialized.');
  console.log(`Loaded ${INITIAL_CRISIS_RESOURCES.length} crisis helpline resources.`);
  console.log(`Loaded ${INITIAL_ROUTINE_TEMPLATES.length} routine templates.`);
  // When database connection is configured, run Prisma client seed operations here
}

main()
  .then(() => {
    console.log('✅ Seed placeholder executed successfully.');
  })
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
