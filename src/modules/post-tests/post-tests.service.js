// src/modules/post-tests/post-tests.service.js
//
// Service domain Post-Test.
// Business logic memakai helper bersama (src/shared/assessment.helpers.js)
// sehingga scoring/passing score/max attempts/mustRepeat/progress tetap
// mengikuti behavior existing.

const helpers = require('../../shared/assessment.helpers')

const TIPE = helpers.ASSESSMENT_TYPE.POST_TEST

// ================================================
// GET POST-TEST BY MODULE
// ================================================
const getPostTestsByModule = async (moduleId) => {
  await helpers.assertModuleExists(moduleId)

  const prisma = require('../../config/database')
  const postTests = await prisma.postTest.findMany({
    where: { moduleId },
    select: {
      id: true,
      judul: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  return postTests.map((postTest) => helpers.attachType(postTest, TIPE))
}

// ================================================
// GET POST-TEST BY ID + SOAL PG
// ================================================
const getPostTestById = async (id) =>
  helpers.getAssessmentById(id, TIPE)

// ================================================
// CREATE POST-TEST (default passingScore = 80, maxAttempts = 3)
// ================================================
const createPostTest = async (moduleId, data) =>
  helpers.createAssessment(moduleId, TIPE, data)

// ================================================
// DELETE POST-TEST
// ================================================
const deletePostTest = async (moduleId, postTestId) =>
  helpers.deleteAssessment(moduleId, postTestId, TIPE)

// ================================================
// QUESTION (logic existing via helper)
// ================================================
const createQuestion = async (postTestId, data) =>
  helpers.createQuestion(postTestId, TIPE, data)

const updateQuestion = async (questionId, data) =>
  helpers.updateQuestion(questionId, data)

const deleteQuestion = async (questionId) =>
  helpers.deleteQuestion(questionId)

// ================================================
// SUBMIT JAWABAN (logic existing via helper)
// ================================================
const submitPostTest = async (postTestId, userId, data) =>
  helpers.submitJawaban(postTestId, TIPE, userId, data)

// ================================================
// ANSWERS
// ================================================
const getAnswersByPostTest = async (postTestId) =>
  helpers.getAnswersByAssessment(postTestId, TIPE)

const getMyAnswers = async (postTestId, userId) =>
  helpers.getMyAnswers(postTestId, TIPE, userId)

module.exports = {
  getPostTestsByModule,
  getPostTestById,
  createPostTest,
  deletePostTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitPostTest,
  getAnswersByPostTest,
  getMyAnswers
}
