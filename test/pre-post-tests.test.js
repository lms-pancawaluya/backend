// test/pre-post-tests.test.js
//
// Test standalone untuk module domain Pre-Test & Post-Test.
// Tidak memakai framework dan TIDAK menyentuh database. Prisma di-mock.
//
// Jalankan: node test/pre-post-tests.test.js

const assert = require('assert')
const path = require('path')
const Module = require('module')

// ================================================
// Mock store in-memory
// ================================================
let db = {
  modules: [],
  preTests: [],
  postTests: [],
  questions: [],
  options: [],
  user_progress: [],
  user_answers: []
}

let idCounter = 0
const nextId = (prefix) => `${prefix}-${++idCounter}`

// ================================================
// Mock Prisma
// ================================================
function createAssessmentDelegate(storeName, assessmentField, idPrefix) {
  return {
    findUnique: async (args) => {
      const { where } = args
      const assessment = db[storeName].find((x) => x.id === where.id)
      if (!assessment) return null

      const out = { ...assessment }
      const wantsQuestions =
        args.include?.questions || args.select?.questions

      if (wantsQuestions) {
        out.questions = db.questions
          .filter((q) => q[assessmentField] === assessment.id)
          .map((q) => ({
            ...q,
            options: db.options.filter((o) => o.questionId === q.id)
          }))
      } else if (args.select) {
        const picked = {}
        for (const k of Object.keys(args.select)) {
          if (args.select[k] && k !== 'questions') picked[k] = assessment[k]
        }
        return picked
      }

      return out
    },
    findMany: async ({ where }) =>
      db[storeName]
        .filter((assessment) => assessment.moduleId === where.moduleId)
        .map((assessment) => ({
          ...assessment,
          _count: {
            questions: db.questions.filter((q) => q[assessmentField] === assessment.id).length
          }
        })),
    create: async ({ data }) => {
      const assessment = {
        id: nextId(idPrefix),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...data
      }
      db[storeName].push(assessment)
      return assessment
    },
    delete: async ({ where }) => {
      const idx = db[storeName].findIndex((x) => x.id === where.id)
      if (idx === -1) {
        const err = new Error('Record to delete does not exist.')
        err.code = 'P2025'
        throw err
      }
      const [removed] = db[storeName].splice(idx, 1)
      const qIds = db.questions
        .filter((q) => q[assessmentField] === where.id)
        .map((q) => q.id)
      db.questions = db.questions.filter((q) => q[assessmentField] !== where.id)
      db.options = db.options.filter((o) => !qIds.includes(o.questionId))
      db.user_answers = db.user_answers.filter(
        (a) => !qIds.includes(a.questionId)
      )
      return removed
    }
  }
}

const mockPrisma = {
  module: {
    findUnique: async ({ where }) =>
      db.modules.find((m) => m.id === where.id) || null
  },
  preTest: createAssessmentDelegate('preTests', 'preTestId', 'pre'),
  postTest: createAssessmentDelegate('postTests', 'postTestId', 'post'),
  question: {
    findUnique: async ({ where }) =>
      db.questions.find((q) => q.id === where.id) || null,
    create: async ({ data }) => {
      const assessmentField = data.preTestId ? 'preTestId' : 'postTestId'
      const q = {
        id: nextId('q'),
        preTestId: data.preTestId || null,
        postTestId: data.postTestId || null,
        pertanyaan: data.pertanyaan,
        tipe: data.tipe,
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
      if (!q[assessmentField]) throw new Error('Assessment id wajib diisi')
      db.questions.push(q)
      const opts = (data.options?.create || []).map((o) => {
        const opt = { id: nextId('opt'), questionId: q.id, ...o }
        db.options.push(opt)
        return opt
      })
      return { ...q, options: opts }
    },
    update: async ({ where, data }) => {
      const q = db.questions.find((x) => x.id === where.id)
      if (data.pertanyaan) q.pertanyaan = data.pertanyaan
      let opts = db.options.filter((o) => o.questionId === q.id)
      if (data.options?.create) {
        opts = data.options.create.map((o) => {
          const opt = { id: nextId('opt'), questionId: q.id, ...o }
          db.options.push(opt)
          return opt
        })
      }
      return { ...q, options: opts }
    },
    delete: async ({ where }) => {
      db.questions = db.questions.filter((q) => q.id !== where.id)
      db.options = db.options.filter((o) => o.questionId !== where.id)
      return { id: where.id }
    }
  },
  option: {
    deleteMany: async ({ where }) => {
      db.options = db.options.filter((o) => o.questionId !== where.questionId)
      return { count: 0 }
    }
  },
  user_progress: {
    findUnique: async ({ where }) => {
      const { userId, moduleId } = where.userId_moduleId
      return (
        db.user_progress.find(
          (p) => p.userId === userId && p.moduleId === moduleId
        ) || null
      )
    },
    upsert: async ({ where, update, create }) => {
      const { userId, moduleId } = where.userId_moduleId
      const existing = db.user_progress.find(
        (p) => p.userId === userId && p.moduleId === moduleId
      )
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const row = { ...create }
      db.user_progress.push(row)
      return row
    }
  },
  user_answers: {
    upsert: async ({ where, update, create }) => {
      const { userId, questionId } = where.userId_questionId
      const existing = db.user_answers.find(
        (a) => a.userId === userId && a.questionId === questionId
      )
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const row = {
        id: nextId('ans'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...create
      }
      db.user_answers.push(row)
      return row
    },
    findMany: async ({ where }) => {
      return db.user_answers.filter((a) => {
        const q = db.questions.find((x) => x.id === a.questionId)
        if (!q) return false
        if (where.question.preTestId && q.preTestId !== where.question.preTestId) return false
        if (where.question.postTestId && q.postTestId !== where.question.postTestId) return false
        if (where.userId && a.userId !== where.userId) return false
        return true
      })
    }
  },
  $transaction: async (fn) => fn(mockPrisma)
}

// ================================================
// Intercept require
// ================================================
const dbPath = path.resolve(__dirname, '../src/config/database.js')
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === dbPath) return mockPrisma
  return originalLoad.apply(this, arguments)
}

const preService = require('../src/modules/pre-tests/pre-tests.service')
const postService = require('../src/modules/post-tests/post-tests.service')
const preController = require('../src/modules/pre-tests/pre-tests.controller')
const postController = require('../src/modules/post-tests/post-tests.controller')

// ================================================
// Runner
// ================================================
let pass = 0
let fail = 0
async function test(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`  FAIL  ${name}`)
    console.log(`        ${e.message}`)
  }
}

function reset() {
  db = {
    modules: [],
    preTests: [],
    postTests: [],
    questions: [],
    options: [],
    user_progress: [],
    user_answers: []
  }
  idCounter = 0
}

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c
      return this
    },
    json(p) {
      this.body = p
      return this
    }
  }
}

const MOD_A = 'mod-a'
const MOD_B = 'mod-b'
const USER = 'user-1'
const GURU = { id: USER, role: 'guru' }

function seedModule(id) {
  db.modules.push({ id, judul: `Modul ${id}` })
}

function seedAssessment({ moduleId, tipe, passingScore, maxAttempts }) {
  const isPreTest = tipe === 'pre_test'
  const assessment = {
    id: nextId(isPreTest ? 'pre' : 'post'),
    moduleId,
    judul: `Assessment ${tipe}`,
    passingScore: passingScore ?? (isPreTest ? 0 : 80),
    maxAttempts: maxAttempts ?? (isPreTest ? 1 : 3),
    createdAt: new Date('2026-01-01T00:00:00Z')
  }

  if (isPreTest) {
    db.preTests.push(assessment)
  } else {
    db.postTests.push(assessment)
  }

  return assessment
}

function seedQuestion(assessmentId, tipe = 'pre_test') {
  const q = {
    id: nextId('q'),
    preTestId: tipe === 'pre_test' ? assessmentId : null,
    postTestId: tipe === 'post_test' ? assessmentId : null,
    pertanyaan: 'Pertanyaan?',
    tipe: 'pilihan_ganda',
    createdAt: new Date('2026-01-01T00:00:00Z')
  }
  db.questions.push(q)
  const optCorrect = { id: nextId('opt'), questionId: q.id, teksOpsi: 'Benar', isCorrect: true }
  const optWrong = { id: nextId('opt'), questionId: q.id, teksOpsi: 'Salah', isCorrect: false }
  db.options.push(optCorrect, optWrong)
  return { question: q, correctId: optCorrect.id, wrongId: optWrong.id }
}

async function main() {
  console.log('\n=== PRE-TEST & POST-TEST MODULE TESTS ===\n')

  // ============ PRE-TEST ============
  console.log('-- PRE-TEST --')

  await test('PRE GET: list pre-test by module', async () => {
    reset()
    seedModule(MOD_A)
    seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })

    const list = await preService.getPreTestsByModule(MOD_A)
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0].tipe, 'pre_test')
  })

  await test('PRE GET by ID: ambil detail + soal', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    seedQuestion(e.id, 'pre_test')

    const detail = await preService.getPreTestById(e.id)
    assert.strictEqual(detail.id, e.id)
    assert.strictEqual(detail.questions.length, 1)
  })

  await test('PRE GET by ID: post_test -> ditolak (tipe mismatch)', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    await assert.rejects(() => preService.getPreTestById(e.id))
  })

  await test('PRE CREATE: defaults passingScore=0, maxAttempts=1', async () => {
    reset()
    seedModule(MOD_A)
    const created = await preService.createPreTest(MOD_A, { judul: 'Pre' })
    assert.strictEqual(created.tipe, 'pre_test')
    assert.strictEqual(created.passingScore, 0)
    assert.strictEqual(created.maxAttempts, 1)
  })

  await test('PRE CREATE: module tidak ada -> error', async () => {
    reset()
    await assert.rejects(() => preService.createPreTest(MOD_A, { judul: 'Pre' }))
  })

  await test('PRE QUESTION CRUD: create, update, delete', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })

    const created = await preService.createQuestion(e.id, {
      pertanyaan: 'Q1',
      options: [
        { teksOpsi: 'A', isCorrect: true },
        { teksOpsi: 'B', isCorrect: false }
      ]
    })
    assert.strictEqual(created.options.length, 2)

    const updated = await preService.updateQuestion(created.id, {
      pertanyaan: 'Q1-updated',
      options: [
        { teksOpsi: 'A2', isCorrect: true },
        { teksOpsi: 'B2', isCorrect: false }
      ]
    })
    assert.strictEqual(updated.pertanyaan, 'Q1-updated')

    const del = await preService.deleteQuestion(created.id)
    assert.strictEqual(del.pesan, 'Soal berhasil dihapus')
    assert.strictEqual(db.questions.length, 0)
  })

  await test('PRE SUBMIT: pre_test -> sedang_belajar, skor utama tidak ditimpa', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    const { question, correctId } = seedQuestion(e.id, 'pre_test')

    const hasil = await preService.submitPreTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: correctId }]
    })

    assert.strictEqual(hasil.skor, 100)
    assert.strictEqual(hasil.passingScore, 0)
    assert.strictEqual(hasil.isLolos, true)
    const prog = db.user_progress[0]
    assert.strictEqual(prog.status, 'sedang_belajar')
    assert.strictEqual(prog.skor, 0) // skor utama tidak ditimpa pre-test
  })

  await test('PRE ANSWERS: get answers by pre-test', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    const { question, correctId } = seedQuestion(e.id, 'pre_test')
    await preService.submitPreTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: correctId }]
    })

    const answers = await preService.getAnswersByPreTest(e.id)
    assert.strictEqual(answers.length, 1)

    const mine = await preService.getMyAnswers(e.id, USER)
    assert.strictEqual(mine.totalSoal, 1)
    assert.strictEqual(mine.skor, 100)
  })

  await test('PRE DELETE: hapus pre-test berhasil', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    const r = await preService.deletePreTest(MOD_A, e.id)
    assert.strictEqual(r.pesan, 'Pre-Test berhasil dihapus')
    assert.strictEqual(db.preTests.length, 0)
  })

  await test('PRE DELETE: post_test via pre-tests -> ditolak', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    await assert.rejects(() => preService.deletePreTest(MOD_A, e.id))
    assert.strictEqual(db.postTests.length, 1)
  })

  // ============ POST-TEST ============
  console.log('-- POST-TEST --')

  await test('POST GET: list post-test by module', async () => {
    reset()
    seedModule(MOD_A)
    seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })

    const list = await postService.getPostTestsByModule(MOD_A)
    assert.strictEqual(list.length, 2)
    assert.ok(list.every((e) => e.tipe === 'post_test'))
  })

  await test('POST GET by ID: pre_test -> ditolak (tipe mismatch)', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    await assert.rejects(() => postService.getPostTestById(e.id))
  })

  await test('POST CREATE: defaults passingScore=80, maxAttempts=3', async () => {
    reset()
    seedModule(MOD_A)
    const created = await postService.createPostTest(MOD_A, { judul: 'Post' })
    assert.strictEqual(created.tipe, 'post_test')
    assert.strictEqual(created.passingScore, 80)
    assert.strictEqual(created.maxAttempts, 3)
  })

  await test('POST CREATE: custom passingScore & maxAttempts dihormati', async () => {
    reset()
    seedModule(MOD_A)
    const created = await postService.createPostTest(MOD_A, {
      judul: 'Post',
      passingScore: 90,
      maxAttempts: 5
    })
    assert.strictEqual(created.passingScore, 90)
    assert.strictEqual(created.maxAttempts, 5)
  })

  await test('POST QUESTION CRUD: create, update, delete', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    const created = await postService.createQuestion(e.id, {
      pertanyaan: 'Q1',
      options: [
        { teksOpsi: 'A', isCorrect: true },
        { teksOpsi: 'B', isCorrect: false }
      ]
    })
    assert.strictEqual(created.options.length, 2)
    const updated = await postService.updateQuestion(created.id, { pertanyaan: 'Q2' })
    assert.strictEqual(updated.pertanyaan, 'Q2')
    const del = await postService.deleteQuestion(created.id)
    assert.strictEqual(del.pesan, 'Soal berhasil dihapus')
  })

  await test('POST SUBMIT lulus -> module selesai, skor ditimpa', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    const { question, correctId } = seedQuestion(e.id, 'post_test')

    const hasil = await postService.submitPostTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: correctId }]
    })
    assert.strictEqual(hasil.skor, 100)
    assert.strictEqual(hasil.isLolos, true)
    assert.strictEqual(db.user_progress[0].status, 'selesai')
    assert.strictEqual(db.user_progress[0].skor, 100)
  })

  await test('POST SUBMIT gagal (belum max attempts) -> sedang_belajar', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    const { question, wrongId } = seedQuestion(e.id, 'post_test')

    const hasil = await postService.submitPostTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: wrongId }]
    })
    assert.strictEqual(hasil.skor, 0)
    assert.strictEqual(hasil.isLolos, false)
    assert.strictEqual(hasil.mustRepeat, false)
    assert.strictEqual(db.user_progress[0].status, 'sedang_belajar')
  })

  await test('POST SUBMIT capai max attempts -> mustRepeat & reset', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test', maxAttempts: 1 })
    const { question, wrongId } = seedQuestion(e.id, 'post_test')

    const hasil = await postService.submitPostTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: wrongId }]
    })
    assert.strictEqual(hasil.mustRepeat, true)
    assert.strictEqual(db.user_progress[0].status, 'belum_mulai')
    assert.strictEqual(db.user_progress[0].attempts, 0)
  })

  await test('POST ANSWERS: get & my answers', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    const { question, correctId } = seedQuestion(e.id, 'post_test')
    await postService.submitPostTest(e.id, USER, {
      jawaban: [{ questionId: question.id, jawaban: correctId }]
    })
    const answers = await postService.getAnswersByPostTest(e.id)
    assert.strictEqual(answers.length, 1)
    const mine = await postService.getMyAnswers(e.id, USER)
    assert.strictEqual(mine.skor, 100)
  })

  await test('POST DELETE: hapus post-test berhasil', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'post_test' })
    const r = await postService.deletePostTest(MOD_A, e.id)
    assert.strictEqual(r.pesan, 'Post-Test berhasil dihapus')
    assert.strictEqual(db.postTests.length, 0)
  })

  await test('POST DELETE: pre_test via post-tests -> ditolak', async () => {
    reset()
    seedModule(MOD_A)
    const e = seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    await assert.rejects(() => postService.deletePostTest(MOD_A, e.id))
    assert.strictEqual(db.preTests.length, 1)
  })

  // ============ CONTROLLER / AUTHZ ============
  console.log('-- CONTROLLER / AUTHZ --')

  await test('CTRL: GET pre-tests list (200)', async () => {
    reset()
    seedModule(MOD_A)
    seedAssessment({ moduleId: MOD_A, tipe: 'pre_test' })
    const res = fakeRes()
    await preController.getPreTestsByModule({ params: { moduleId: MOD_A } }, res)
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body.jumlah, 1)
  })

  await test('CTRL: DELETE pre-test 404 saat tidak ada', async () => {
    reset()
    const res = fakeRes()
    await preController.deletePreTest(
      { params: { moduleId: MOD_A, preTestId: 'x' } },
      res
    )
    assert.strictEqual(res.statusCode, 404)
  })

  await test('CTRL: DELETE post-test moduleId mismatch -> 400', async () => {
    reset()
    seedModule(MOD_A)
    seedModule(MOD_B)
    const e = seedAssessment({ moduleId: MOD_B, tipe: 'post_test' })
    const res = fakeRes()
    await postController.deletePostTest(
      { params: { moduleId: MOD_A, postTestId: e.id } },
      res
    )
    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(db.postTests.length, 1)
  })

  await test('AUTHZ: unauthenticated -> 401', async () => {
    const authMiddleware = require('../src/middlewares/auth.middleware')
    const res = fakeRes()
    let called = false
    await authMiddleware({ headers: {} }, res, () => {
      called = true
    })
    assert.strictEqual(called, false)
    assert.strictEqual(res.statusCode, 401)
  })

  await test('AUTHZ: role guru ditolak roleMiddleware(admin) -> 403', async () => {
    const roleMiddleware = require('../src/middlewares/role.middleware')
    const res = fakeRes()
    let called = false
    roleMiddleware('admin')({ user: GURU }, res, () => {
      called = true
    })
    assert.strictEqual(called, false)
    assert.strictEqual(res.statusCode, 403)
  })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===\n`)

  Module._load = originalLoad
  process.exit(fail === 0 ? 0 : 1)
}

main()
