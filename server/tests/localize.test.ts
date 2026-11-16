import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLanguage,
  pickLocalized,
  localizeStarterRoutine,
} from '../src/utils/localize.js';

test('resolveLanguage resolves query parameter with highest priority', () => {
  // Query param 'am' should win even if user profile preference is 'EN'
  assert.equal(resolveLanguage('am', 'EN'), 'am');
  assert.equal(resolveLanguage('en', 'AM'), 'en');
  // Case-insensitivity and trimming
  assert.equal(resolveLanguage('  AM  ', 'EN'), 'am');
  assert.equal(resolveLanguage('EN', 'AM'), 'en');
});

test('resolveLanguage falls back to user preferredLanguage when query is missing or invalid', () => {
  assert.equal(resolveLanguage(undefined, 'AM'), 'am');
  assert.equal(resolveLanguage(undefined, 'EN'), 'en');
  assert.equal(resolveLanguage('invalid-lang', 'AM'), 'am');
  assert.equal(resolveLanguage(null, 'EN'), 'en');
});

test('resolveLanguage falls back to default English (en) when no preference is provided', () => {
  assert.equal(resolveLanguage(undefined, undefined), 'en');
  assert.equal(resolveLanguage(undefined, null), 'en');
  assert.equal(resolveLanguage('unknown', 'unknown'), 'en');
});

test('pickLocalized selects preferred language with fallback to alternate', () => {
  assert.equal(pickLocalized('English Title', 'የአማርኛ ርዕስ', 'en'), 'English Title');
  assert.equal(pickLocalized('English Title', 'የአማርኛ ርዕስ', 'am'), 'የአማርኛ ርዕስ');

  // Fallback when chosen language is missing
  assert.equal(pickLocalized('English Only', null, 'am'), 'English Only');
  assert.equal(pickLocalized(null, 'አማርኛ ብቻ', 'en'), 'አማርኛ ብቻ');
});

test('localizeStarterRoutine returns client-facing shape without raw En/Am columns', () => {
  const row = {
    id: 'starter-1',
    titleEn: 'Morning Sunlight',
    titleAm: 'የጠዋት ፀሐይ መሞቅ',
    descriptionEn: 'Spend 10 minutes outside in the morning sun.',
    descriptionAm: 'ጠዋት 10 ደቂቃ ከቤት ውጭ ፀሐይ ይሞቁ።',
    category: 'MINDFULNESS',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const localizedEn = localizeStarterRoutine(row, 'en');
  assert.equal(localizedEn.id, 'starter-1');
  assert.equal(localizedEn.title, 'Morning Sunlight');
  assert.equal(localizedEn.description, 'Spend 10 minutes outside in the morning sun.');
  assert.equal((localizedEn as any).titleEn, undefined);
  assert.equal((localizedEn as any).titleAm, undefined);

  const localizedAm = localizeStarterRoutine(row, 'am');
  assert.equal(localizedAm.title, 'የአማርኛ ርዕስ' ? 'የጠዋት ፀሐይ መሞቅ' : '');
  assert.equal(localizedAm.description, 'ጠዋት 10 ደቂቃ ከቤት ውጭ ፀሐይ ይሞቁ።');
});
