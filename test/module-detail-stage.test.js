// test/module-detail-stage.test.js
//
// Test standalone untuk kontrak stage-completion pada
// GET /api/modules/:moduleId (modules.service.getModuleById).
// Tidak memakai framework (repo tidak memilikinya) dan TIDAK
// menyentuh database. Prisma & progress.service di-mock.
//
// Jalankan: node test/module-detail-stage.test.js

const assert = require('assert')
const path = require('path')
const Module = require('module')

// ================================================
// Mock store in-memory
// ================================================
let db = {
  modules: []
}

// Stage map yang dikembalikan oleh mock hitungStageCompletion,
// sekaligus merekam argumen pemanggilan.
let stageMapMock = {}
let lastStageCall = null

// ================================================
// Mock Prisma
// ================================================
const mockPrisma = {
  module: {
    findUnique: async ({ where }) =>
      db.modules.find((m) => m.id === where.id) || null
  }
}

// ================================================
// Mock progress.service (single source of truth completion)
// ================================================
const mockProgressService = {
  hitungStageCompletion: async (userId, moduleIds) => {
    lastStageCall = { userId, moduleIds }
    const out = {}
    moduleIds.forEach((id) => {
      out[id] = stageMapMock[id] || {
        preTestCompleted: false,
        materialCompleted: false,
        postTestCompleted: false
      }
    })
    return out
  }
}

// ================================================
// Intercept require
// ================================================
const dbPath = path.resolve(__dirname, '../src/config/database.js')
const progressPath = path.resolve(
  __dirname,
  '../src/modules/progress/progress.service.js'
)
// notifications.service di-mock agar modules.service dapat di-require
// tanpa menyentuh dependensi lain.
const notifPath = path.resolve(
  __dirname,
  '../src/modules/notifications/notifications.service.js'
)
const mockNotifService = {}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === dbPath) return mockPrisma
  if (resolved === progressPath) return mockProgressService
  if (resolved === notifPath) return mockNotifService
  return originalLoad.apply(this, arguments)
}

const service = require('../src/modules/modules/modules.service')

// ================================================
// Test runner
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

// ================================================
// Helpers
// ================================================
function reset() {
  db = { modules: [] }
  stageMapMock = {}
  lastStageCall = null
}

function seedModule(overrides = {}) {
  const module = {
    id: 'm1',
    courseId: 'c1',
    judul: 'Modul 1',
    deskripsi: 'Deskripsi',
    aspekPancawaluya: 'umum',
    urutan: 1,
    course: { id: 'c1', schoolId: null },
    contents: [],
    preTests: [],
    postTests: [],
    ...overrides
  }
  db.modules.push(module)
  return module
}

const GURU = { id: 'u1', role: 'guru', schoolId: 'sch1' }
const ADMIN = { id: 'admin1', role: 'admin', schoolId: null }

async function main() {
  console.log('\n=== MODULE DETAIL STAGE TESTS ===\n')

  // ------------------------------------------------
  // 1. Response mengandung ketiga flag
  // ------------------------------------------------
  await test('GET module detail: mengandung preTestCompleted/materialCompleted/postTestCompleted', async () => {
    reset()
    seedModule()
    stageMapMock['m1'] = {
      preTestCompleted: true,
      materialCompleted: false,
      postTestCompleted: false
    }
    const res = await service.getModuleById('m1', GURU)
    assert.strictEqual(res.preTestCompleted, true)
    assert.strictEqual(res.materialCompleted, false)
    assert.strictEqual(res.postTestCompleted, false)
  })

  // ------------------------------------------------
  // 2. Nilai sesuai hitungStageCompletion & argumen benar
  // ------------------------------------------------
  await test('Nilai flag match hitungStageCompletion(userId, [moduleId])', async () => {
    reset()
    seedModule()
    stageMapMock['m1'] = {
      preTestCompleted: false,
      materialCompleted: true,
      postTestCompleted: true
    }
    const res = await service.getModuleById('m1', GURU)
    assert.deepStrictEqual(lastStageCall, { userId: 'u1', moduleIds: ['m1'] })
    assert.strictEqual(res.preTestCompleted, false)
    assert.strictEqual(res.materialCompleted, true)
    assert.strictEqual(res.postTestCompleted, true)
  })

  // ------------------------------------------------
  // 3. Setelah pre-test submit (di mock: user punya answer)
  // ------------------------------------------------
  await test('Setelah pre-test submit -> preTestCompleted true', async () => {
    reset()
    seedModule({ preTests: [{ id: 'pre1', judul: 'Pre', createdAt: new Date() }] })
    // Simulasi state setelah submit: assessmentDijawab berisi pre1
    stageMapMock['m1'] = {
      preTestCompleted: true,
      materialCompleted: false,
      postTestCompleted: false
    }
    const res = await service.getModuleById('m1', GURU)
    assert.strictEqual(res.preTestCompleted, true)
    // user_answers persistence tetap ditangani di layer submit (tidak di sini)
  })

  // ------------------------------------------------
  // 4. Semua stage unavailable -> ketiga flag true
  // ------------------------------------------------
  await test('Semua stage unavailable -> ketiga flag true', async () => {
    reset()
    seedModule() // tanpa contents/preTests/postTests
    stageMapMock['m1'] = {
      preTestCompleted: true,
      materialCompleted: true,
      postTestCompleted: true
    }
    const res = await service.getModuleById('m1', GURU)
    assert.strictEqual(res.preTestCompleted, true)
    assert.strictEqual(res.materialCompleted, true)
    assert.strictEqual(res.postTestCompleted, true)
  })

  // ------------------------------------------------
  // 5. Field existing tetap ada (additive)
  // ------------------------------------------------
  await test('Field existing (id, judul, contents, evaluations) tetap ada', async () => {
    reset()
    seedModule({
      preTests: [{ id: 'pre1', judul: 'Pre', createdAt: new Date() }],
      postTests: [{ id: 'post1', judul: 'Post', createdAt: new Date() }]
    })
    stageMapMock['m1'] = {
      preTestCompleted: true,
      materialCompleted: true,
      postTestCompleted: true
    }
    const res = await service.getModuleById('m1', GURU)
    assert.strictEqual(res.id, 'm1')
    assert.strictEqual(res.judul, 'Modul 1')
    assert.ok(Array.isArray(res.contents))
    assert.ok(Array.isArray(res.evaluations))
    assert.strictEqual(res.evaluations.length, 2)
    assert.strictEqual(res.evaluations[0].tipe, 'pre_test')
    assert.strictEqual(res.evaluations[1].tipe, 'post_test')
  })

  // ------------------------------------------------
  // 6. Admin juga mendapat flag
  // ------------------------------------------------
  await test('Admin tetap mendapat flag stage', async () => {
    reset()
    seedModule()
    stageMapMock['m1'] = {
      preTestCompleted: true,
      materialCompleted: true,
      postTestCompleted: false
    }
    const res = await service.getModuleById('m1', ADMIN)
    assert.strictEqual(res.preTestCompleted, true)
    assert.strictEqual(res.materialCompleted, true)
    assert.strictEqual(res.postTestCompleted, false)
  })

  // ------------------------------------------------
  // 7. Tanpa currentUser -> fallback false, tidak error
  // ------------------------------------------------
  await test('Tanpa currentUser -> flag false, tidak memanggil hitungStageCompletion', async () => {
    reset()
    seedModule()
    const res = await service.getModuleById('m1', null)
    assert.strictEqual(res.preTestCompleted, false)
    assert.strictEqual(res.materialCompleted, false)
    assert.strictEqual(res.postTestCompleted, false)
    assert.strictEqual(lastStageCall, null)
  })

  // ------------------------------------------------
  // 8. Module tidak ditemukan -> 404 tetap
  // ------------------------------------------------
  await test('Module tidak ditemukan -> error 404', async () => {
    reset()
    let err = null
    try {
      await service.getModuleById('tidak-ada', GURU)
    } catch (e) {
      err = e
    }
    assert.ok(err, 'harus melempar error')
    assert.strictEqual(err.statusCode, 404)
  })

  // ------------------------------------------------
  // 9. School-scope tetap: non-admin beda sekolah -> 403
  // ------------------------------------------------
  await test('School-scope: guru beda sekolah -> 403', async () => {
    reset()
    seedModule({ course: { id: 'c1', schoolId: 'sch2' } })
    let err = null
    try {
      await service.getModuleById('m1', GURU)
    } catch (e) {
      err = e
    }
    assert.ok(err, 'harus melempar error')
    assert.strictEqual(err.statusCode, 403)
  })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===\n`)
  if (fail > 0) process.exit(1)
}

main()
