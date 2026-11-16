import test from 'node:test';
import assert from 'node:assert/strict';
import { AssessmentDomain } from '@mindrise/database';
import {
  scoreAssessment,
  ScoringTemplateInput,
  ScoringQuestionInput,
} from '../src/services/assessment-scoring.js';
import { AppError } from '../src/middleware/errorHandler.js';

const mockTemplate: ScoringTemplateInput = {
  id: 'template-stress-v1',
  domain: AssessmentDomain.STRESS,
  riskThreshold: 10,
};

const mockQuestions: ScoringQuestionInput[] = [
  {
    id: 'q1',
    templateId: mockTemplate.id,
    order: 1,
    isRiskItem: false,
    scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
  },
  {
    id: 'q2-reverse',
    templateId: mockTemplate.id,
    order: 2,
    isRiskItem: false,
    // Reverse coded question from seed
    scoring: { always: 0, often: 1, sometimes: 2, rarely: 3 },
  },
  {
    id: 'q3',
    templateId: mockTemplate.id,
    order: 3,
    isRiskItem: false,
    scoring: { rarely: 0, sometimes: 1, often: 2, always: 3 },
  },
  {
    id: 'q4-risk',
    templateId: mockTemplate.id,
    order: 4,
    isRiskItem: true,
    scoring: { never: 0, rarely: 1, sometimes: 2, frequently: 4 },
  },
];

test('scoreAssessment - successfully calculates score, summaryKey, and riskFlagged', () => {
  const answers = [
    { questionId: 'q1', value: 'sometimes' }, // 1
    { questionId: 'q2-reverse', value: 'sometimes' }, // 2
    { questionId: 'q3', value: 'often' }, // 2
    { questionId: 'q4-risk', value: 'never' }, // 0 (safe)
  ];

  const result = scoreAssessment(mockTemplate, mockQuestions, answers);
  assert.equal(result.score, 5); // 1 + 2 + 2 + 0 = 5
  assert.equal(result.summaryKey, 'MODERATE');
  assert.equal(result.riskFlagged, false);
});

test('scoreAssessment - ignores client-supplied score in answer payload', () => {
  const answers = [
    { questionId: 'q1', value: 'rarely', score: 999 }, // actual 0
    { questionId: 'q2-reverse', value: 'always', score: 888 }, // actual 0
    { questionId: 'q3', value: 'rarely', score: 777 }, // actual 0
    { questionId: 'q4-risk', value: 'never', score: 666 }, // actual 0
  ];

  const result = scoreAssessment(mockTemplate, mockQuestions, answers);
  assert.equal(result.score, 0);
  assert.equal(result.summaryKey, 'LOW');
  assert.equal(result.riskFlagged, false);
});

test('scoreAssessment - correctly scores reverse-coded questions', () => {
  // In Q2: 'always' is 0, 'rarely' is 3
  const answersRarely = [
    { questionId: 'q1', value: 'rarely' }, // 0
    { questionId: 'q2-reverse', value: 'rarely' }, // 3
    { questionId: 'q3', value: 'rarely' }, // 0
    { questionId: 'q4-risk', value: 'never' }, // 0
  ];
  assert.equal(scoreAssessment(mockTemplate, mockQuestions, answersRarely).score, 3);

  const answersAlways = [
    { questionId: 'q1', value: 'rarely' }, // 0
    { questionId: 'q2-reverse', value: 'always' }, // 0
    { questionId: 'q3', value: 'rarely' }, // 0
    { questionId: 'q4-risk', value: 'never' }, // 0
  ];
  assert.equal(scoreAssessment(mockTemplate, mockQuestions, answersAlways).score, 0);
});

test('scoreAssessment - triggers riskFlagged on score >= riskThreshold boundary', () => {
  // Score = 9 (below threshold 10, no risk item) -> riskFlagged: false
  const answers9 = [
    { questionId: 'q1', value: 'always' }, // 3
    { questionId: 'q2-reverse', value: 'rarely' }, // 3
    { questionId: 'q3', value: 'always' }, // 3
    { questionId: 'q4-risk', value: 'never' }, // 0 (safe)
  ];
  const res9 = scoreAssessment(mockTemplate, mockQuestions, answers9);
  assert.equal(res9.score, 9);
  assert.equal(res9.riskFlagged, false);
  assert.equal(res9.summaryKey, 'MODERATE');

  // Score = 10 (at threshold 10) -> riskFlagged: true
  const answers10 = [
    { questionId: 'q1', value: 'always' }, // 3
    { questionId: 'q2-reverse', value: 'rarely' }, // 3
    { questionId: 'q3', value: 'always' }, // 3
    { questionId: 'q4-risk', value: 'rarely' }, // 1 (also triggers risk item)
  ];
  const res10 = scoreAssessment(mockTemplate, mockQuestions, answers10);
  assert.equal(res10.score, 10);
  assert.equal(res10.riskFlagged, true);
  assert.equal(res10.summaryKey, 'HIGH');
});

test('scoreAssessment - risk-item-only trigger works even when total score is well below threshold', () => {
  // Total score = 4 (threshold is 10), but q4 is answered with 'frequently' (4 > 0 safe value)
  const answers = [
    { questionId: 'q1', value: 'rarely' }, // 0
    { questionId: 'q2-reverse', value: 'always' }, // 0
    { questionId: 'q3', value: 'rarely' }, // 0
    { questionId: 'q4-risk', value: 'frequently' }, // 4 (CRITICAL RISK ITEM)
  ];

  const result = scoreAssessment(mockTemplate, mockQuestions, answers);
  assert.equal(result.score, 4);
  assert.ok(result.score < mockTemplate.riskThreshold); // 4 < 10
  assert.equal(result.riskFlagged, true); // Still flagged due to critical risk item
});

test('scoreAssessment - rejects missing answers with 400', () => {
  const incompleteAnswers = [
    { questionId: 'q1', value: 'rarely' },
    { questionId: 'q2-reverse', value: 'always' },
  ];

  assert.throws(
    () => scoreAssessment(mockTemplate, mockQuestions, incompleteAnswers),
    (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_ASSESSMENT_ANSWERS');
      return true;
    }
  );
});

test('scoreAssessment - rejects duplicate question answers with 400', () => {
  const duplicateAnswers = [
    { questionId: 'q1', value: 'rarely' },
    { questionId: 'q1', value: 'always' },
    { questionId: 'q2-reverse', value: 'always' },
    { questionId: 'q3', value: 'rarely' },
  ];

  assert.throws(
    () => scoreAssessment(mockTemplate, mockQuestions, duplicateAnswers),
    (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_ASSESSMENT_ANSWERS');
      return true;
    }
  );
});

test('scoreAssessment - rejects unknown question ID with 400', () => {
  const unknownAnswers = [
    { questionId: 'q1', value: 'rarely' },
    { questionId: 'q2-reverse', value: 'always' },
    { questionId: 'q3', value: 'rarely' },
    { questionId: 'unknown-id-999', value: 'never' },
  ];

  assert.throws(
    () => scoreAssessment(mockTemplate, mockQuestions, unknownAnswers),
    (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_ASSESSMENT_ANSWERS');
      return true;
    }
  );
});

test('scoreAssessment - rejects out-of-range or invalid option value with 400', () => {
  const invalidValueAnswers = [
    { questionId: 'q1', value: 'super-stressed-invalid' },
    { questionId: 'q2-reverse', value: 'always' },
    { questionId: 'q3', value: 'rarely' },
    { questionId: 'q4-risk', value: 'never' },
  ];

  assert.throws(
    () => scoreAssessment(mockTemplate, mockQuestions, invalidValueAnswers),
    (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_ASSESSMENT_ANSWERS');
      return true;
    }
  );
});
