// src/modules/pre-tests/pre-tests.service.js
//
// Service domain Pre-Test.
// Business logic memakai helper bersama (src/shared/assessment.helpers.js)
// sehingga scoring/passing score/max attempts/mustRepeat/progress IDENTIK
// dengan implementasi existing. Compatibility layer DB: `Evaluation.tipe = "pre_test"`.

const helpers = require('../../shared/assessment.helpers')

const TIPE = helpers.ASSESSMENT_TYPE.PRE_TEST

// ================================================
// GET PRE-TEST BY MODULE
// ================================================
const getPreTestsByModule = async (moduleId) => {
  await helpers.assertModuleExists(moduleId)

  const preTests = await prismaFindPreTests(moduleId)
  return preTests
}

// Query terpisah agar select/orderBy tetap sama dengan existing.
const prismaFindPreTests = async (moduleId) => {
  const prisma = require('../../config/database')
  return prisma.evaluation.findMany({
    where: { moduleId, tipe: TIPE },
    select: {
      id: true,
      judul: true,
      tipe: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  })
}

// ================================================
// GET PRE-TEST BY ID + SOAL PG
// ================================================
const getPreTestById = async (id) =>
  helpers.getAssessmentById(id, TIPE)

// ================================================
// CREATE PRE-TEST (passingScore = 0, maxAttempts = 1)
// ================================================
const createPreTest = async (moduleId, data) =>
  helpers.createAssessment(moduleId, TIPE, data)

// ================================================
// DELETE PRE-TEST
// ================================================
const deletePreTest = async (moduleId, preTestId) =>
  helpers.deleteAssessment(moduleId, preTestId, TIPE)

// ================================================
// QUESTION (logic existing via helper)
// ================================================
const createQuestion = async (preTestId, data) =>
  helpers.createQuestion(preTestId, data)

const updateQuestion = async (questionId, data) =>
  helpers.updateQuestion(questionId, data)

const deleteQuestion = async (questionId) =>
  helpers.deleteQuestion(questionId)

// ================================================
// SUBMIT JAWABAN (logic existing via helper)
// ================================================
const submitPreTest = async (preTestId, userId, data) =>
  helpers.submitJawaban(preTestId, userId, data)

// ================================================
// ANSWERS
// ================================================
const getAnswersByPreTest = async (preTestId) =>
  helpers.getAnswersByEvaluation(preTestId)

const getMyAnswers = async (preTestId, userId) =>
  helpers.getMyAnswers(preTestId, userId)

module.exports = {
  getPreTestsByModule,
  getPreTestById,
  createPreTest,
  deletePreTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitPreTest,
  getAnswersByPreTest,
  getMyAnswers
}
