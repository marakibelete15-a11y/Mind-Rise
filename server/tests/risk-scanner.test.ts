import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, normalizeRiskText } from '../src/utils/risk-scanner.js';

test('normalizeRiskText handles English, Amharic, contractions, and punctuation', () => {
  // English contraction & casing
  assert.equal(
    normalizeRiskText("  I Don't Want To Wake Up!!  "),
    'i dont want to wake up'
  );

  // Amharic with Ge'ez word space and full stop
  assert.equal(
    normalizeRiskText('ራሴን፡መግደል፡እፈልጋለሁ።'),
    'ራሴን መግደል እፈልጋለሁ'
  );

  // Empty or whitespace text
  assert.equal(normalizeRiskText(''), '');
  assert.equal(normalizeRiskText('   \n\t  '), '');
});

test('scanText detects CRITICAL tier in English', () => {
  // Direct match
  const res1 = scanText('I want to kill myself');
  assert.deepEqual(res1, { matched: true, priority: 'CRITICAL' });

  // Variations in casing and surrounding text
  const res2 = scanText('Everything is too dark, I WILL KILL MYSELF tonight.');
  assert.deepEqual(res2, { matched: true, priority: 'CRITICAL' });

  // Contraction variation
  const res3 = scanText("im going to end my life");
  assert.deepEqual(res3, { matched: true, priority: 'CRITICAL' });
});

test('scanText detects CRITICAL tier in Amharic', () => {
  // Standard space
  const res1 = scanText('ራሴን መግደል እፈልጋለሁ');
  assert.deepEqual(res1, { matched: true, priority: 'CRITICAL' });

  // With Ge'ez punctuation (፡ and ።)
  const res2 = scanText('በጣም ተስፋ ቆርጫለሁ ራሴን፡ልገድል፡ነው።');
  assert.deepEqual(res2, { matched: true, priority: 'CRITICAL' });
});

test('scanText detects HIGH tier in English', () => {
  // Hopelessness phrase
  const res1 = scanText('I have no reason to live anymore.');
  assert.deepEqual(res1, { matched: true, priority: 'HIGH' });

  // Apostrophe variation
  const res2 = scanText("I don't want to wake up tomorrow morning");
  assert.deepEqual(res2, { matched: true, priority: 'HIGH' });

  const res3 = scanText('I cant take this life anymore');
  assert.deepEqual(res3, { matched: true, priority: 'HIGH' });
});

test('scanText detects HIGH tier in Amharic', () => {
  const res1 = scanText('መሞት እፈልጋለሁ');
  assert.deepEqual(res1, { matched: true, priority: 'HIGH' });

  const res2 = scanText('ህይወት ሰልችቶኛል በጣም ከብዶኛል');
  assert.deepEqual(res2, { matched: true, priority: 'HIGH' });
});

test('scanText prioritizes CRITICAL when both CRITICAL and HIGH phrases are present', () => {
  // "i want to die" (HIGH) and "i will kill myself" (CRITICAL)
  const res = scanText('I want to die, so I will kill myself.');
  assert.deepEqual(res, { matched: true, priority: 'CRITICAL' });
});

test('scanText ignores harmless near-misses and idioms', () => {
  // "kill this exam" (should NOT match "kill myself")
  assert.deepEqual(scanText('I am going to kill this exam tomorrow!'), {
    matched: false,
    priority: null,
  });

  // "dying of laughter" (should NOT match "want to die")
  assert.deepEqual(scanText('That joke was so funny, I am literally dying of laughter.'), {
    matched: false,
    priority: null,
  });

  // "skill" contains "kill" as substring
  assert.deepEqual(scanText('Learning a new skill for my next job search.'), {
    matched: false,
    priority: null,
  });

  // "diet" or "died" near-misses
  assert.deepEqual(scanText('Starting a new diet and exercise routine.'), {
    matched: false,
    priority: null,
  });
});

test('scanText handles edge cases: empty, punctuation only, and very long text', () => {
  assert.deepEqual(scanText(''), { matched: false, priority: null });
  assert.deepEqual(scanText('   ??? !!! ...   '), { matched: false, priority: null });

  // Very long benign text
  const longBenignText = 'This is a long community essay about personal wellness and studying daily. '.repeat(100);
  assert.deepEqual(scanText(longBenignText), { matched: false, priority: null });

  // Very long text containing a trigger embedded in the middle
  const longWithTrigger = `${longBenignText} I have no reason to live. ${longBenignText}`;
  assert.deepEqual(scanText(longWithTrigger), { matched: true, priority: 'HIGH' });
});
