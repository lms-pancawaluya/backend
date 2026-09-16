// test/certificates.test.js
//
// Test standalone untuk fitur Sertifikat (LMS Pancawaluya).
// Tidak memakai framework (repo tidak memilikinya) dan TIDAK
// menyentuh database. Prisma & progress.service di-mock.
//
// Jalankan: node test/certificates.test.js

const assert = require('assert')
const path = require('path')
const Module = require('module')

// ================================================
// Mock store in-memory
// ================================================
let db = {
  users: [],
  courses: [],
  modules: [],
  certificates: []
}

let stageMapMock = {}

// ================================================
// Mock Prisma
// ================================================
const mockPrisma = {
  user: {
    findUnique: async ({ where }) =>
      db.users.find((u) => u.id === where.id) || null
  },
  course: {
    findUnique: async ({ where }) =>
      db.courses.find((c) => c.id === where.id) || null
  },
  module: {
    findMany: async ({ where }) =>
      db.modules.filter((m) => m.courseId === where.courseId)
  },
  certificate: {
    findMany: async ({ where }) =>
      db.certificates
        .filter((c) => c.userId === where.userId)
        .map((c) => ({
          ...c,
          course: db.courses.find((k) => k.id === c.courseId) || null
        })),
    findUnique: async ({ where }) => {
      if (where.id) {
        const c = db.certificates.find((x) => x.id === where.id)
        if (!c) return null
        return {
          ...c,
          course: db.courses.find((k) => k.id === c.courseId) || null
        }
      }
      const { userId, courseId } = where.userId_courseId
      const c = db.certificates.find(
        (x) => x.userId === userId && x.courseId === courseId
      )
      if (!c) return null
      return {
        ...c,
        course: db.courses.find((k) => k.id === c.courseId) || null
      }
    },
    create: async ({ data }) => {
      // Simulasi unique constraint (userId, courseId) & nomorSertifikat
      const dupUserCourse = db.certificates.find(
        (c) => c.userId === data.userId && c.courseId === data.courseId
      )
      if (dupUserCourse) {
        const e = new Error('duplicate')
        e.code = 'P2002'
        throw e
      }
      const dupNomor = db.certificates.find(
        (c) => c.nomorSertifikat === data.nomorSertifikat
      )
      if (dupNomor) {
        const e = new Error('duplicate nomor')
        e.code = 'P2002'
        throw e
      }
      const cert = {
        id: 'cert-' + (db.certificates.length + 1),
        ...data,
        issuedAt: new Date('2026-03-01T00:00:00Z'),
        createdAt: new Date('2026-03-01T00:00:00Z')
      }
      db.certificates.push(cert)
      return cert
    }
  }
}

// ================================================
// Mock progress.service (single source of truth completion)
// ================================================
const mockProgressService = {
  hitungStageCompletion: async (userId, moduleIds) => {
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

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === dbPath) return mockPrisma
  if (resolved === progressPath) return mockProgressService
  return originalLoad.apply(this, arguments)
}

const service = require('../src/modules/certificates/certificates.service')

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
// Helper reset
// ================================================
function reset() {
  db = { users: [], courses: [], modules: [], certificates: [] }
  stageMapMock = {}
}

const GURU = { id: 'u1', nama: 'Ikhsan Dwi Putra', role: 'guru', schoolId: 'sch1' }
const COURSE = { id: 'c1', judul: 'Course A', schoolId: null, hasCertificate: true }

function seedBase() {
  reset()
  db.users.push({ ...GURU })
  db.courses.push({ ...COURSE })
}

function modulesSelesai(ids) {
  ids.forEach((id) => {
    db.modules.push({ id, courseId: 'c1' })
    stageMapMock[id] = {
      preTestCompleted: true,
      materialCompleted: true,
      postTestCompleted: true
    }
  })
}

async function main() {
  console.log('\n=== CERTIFICATE TESTS ===\n')

  // ------------------------------------------------
  // 1. Course 0% -> claim rejected
  // ------------------------------------------------
  await test('CASE 1: course 0% -> claim rejected (400)', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    stageMapMock['m1'] = {
      preTestCompleted: false,
      materialCompleted: false,
      postTestCompleted: false
    }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400 && /belum 100%/.test(e.message)
    )
    assert.strictEqual(db.certificates.length, 0, 'tidak boleh membuat sertifikat')
  })

  // ------------------------------------------------
  // 2. Course <100% (1 dari 2 module) -> rejected
  // ------------------------------------------------
  await test('CASE 2: course <100% -> claim rejected', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    db.modules.push({ id: 'm2', courseId: 'c1' })
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: true, postTestCompleted: true }
    stageMapMock['m2'] = { preTestCompleted: true, materialCompleted: false, postTestCompleted: false }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400
    )
    assert.strictEqual(db.certificates.length, 0)
  })

  // ------------------------------------------------
  // 3. Course 100% -> claim successful
  // ------------------------------------------------
  await test('CASE 3: course 100% -> claim created', async () => {
    seedBase()
    modulesSelesai(['m1', 'm2'])
    const r = await service.claimCertificate('u1', 'c1')
    assert.strictEqual(r.status, 'created')
    assert.strictEqual(db.certificates.length, 1)
  })

  // ------------------------------------------------
  // 4. Nama dari profile user
  // ------------------------------------------------
  await test('CASE 4: recipientName diambil dari profile user', async () => {
    seedBase()
    modulesSelesai(['m1'])
    const r = await service.claimCertificate('u1', 'c1')
    assert.strictEqual(r.certificate.recipientName, 'Ikhsan Dwi Putra')
  })

  // ------------------------------------------------
  // 5. Snapshot nama (ganti nama setelah issue)
  // ------------------------------------------------
  await test('CASE 5: recipientName snapshot tidak berubah saat nama profile diganti', async () => {
    seedBase()
    modulesSelesai(['m1'])
    const r = await service.claimCertificate('u1', 'c1')
    // ganti nama profile
    db.users[0].nama = 'Nama Baru'
    const detail = await service.getCertificateById(r.certificate.id, GURU)
    assert.strictEqual(detail.recipientName, 'Ikhsan Dwi Putra')
  })

  // ------------------------------------------------
  // 6. Claim kedua -> no duplicate
  // ------------------------------------------------
  await test('CASE 6: claim kedua tidak membuat duplikat & issuedAt tetap', async () => {
    seedBase()
    modulesSelesai(['m1'])
    const r1 = await service.claimCertificate('u1', 'c1')
    const r2 = await service.claimCertificate('u1', 'c1')
    assert.strictEqual(r2.status, 'already_claimed')
    assert.strictEqual(db.certificates.length, 1)
    assert.strictEqual(r1.certificate.id, r2.certificate.id)
    assert.strictEqual(
      r1.certificate.certificateNumber,
      r2.certificate.certificateNumber
    )
    assert.strictEqual(
      r1.certificate.issuedAt.toISOString(),
      r2.certificate.issuedAt.toISOString()
    )
  })

  // ------------------------------------------------
  // 7. Certificate number unique & format
  // ------------------------------------------------
  await test('CASE 7: certificate number unik format PANC-<tahun>-XXXXXXXX', async () => {
    seedBase()
    modulesSelesai(['m1'])
    const r = await service.claimCertificate('u1', 'c1')
    assert.match(r.certificate.certificateNumber, /^PANC-\d{4}-[0-9A-F]{8}$/)

    // generate 500 nomor -> harus unik
    const nums = new Set()
    for (let i = 0; i < 500; i++) {
      nums.add(service.generateNomorSertifikat())
    }
    assert.strictEqual(nums.size, 500, 'nomor harus unik')
  })

  // ------------------------------------------------
  // 8. User tidak bisa akses course sekolah lain
  // ------------------------------------------------
  await test('CASE 7/8: user sekolah lain -> claim rejected 403', async () => {
    reset()
    db.users.push({ id: 'u2', nama: 'Guru Lain', role: 'guru', schoolId: 'sch2' })
    db.courses.push({ id: 'c2', judul: 'Course Sekolah', schoolId: 'sch1', hasCertificate: true })
    await assert.rejects(
      () => service.claimCertificate('u2', 'c2'),
      (e) => e.statusCode === 403
    )
  })

  // ------------------------------------------------
  // 9. Course 0 module -> tidak otomatis eligible
  // ------------------------------------------------
  await test('CASE 2(0 modul): course 0 module -> rejected, tidak eligible', async () => {
    seedBase()
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400
    )
    assert.strictEqual(db.certificates.length, 0)
  })

  // ------------------------------------------------
  // 10. Course tidak ditemukan
  // ------------------------------------------------
  await test('CASE 1: course tidak ditemukan -> 404', async () => {
    seedBase()
    await assert.rejects(
      () => service.claimCertificate('u1', 'TIDAK_ADA'),
      (e) => e.statusCode === 404
    )
  })

  // ------------------------------------------------
  // 11. Course hasCertificate = false -> ditolak
  // ------------------------------------------------
  await test('Course tanpa sertifikat -> rejected', async () => {
    reset()
    db.users.push(GURU)
    db.courses.push({ id: 'c3', judul: 'No Cert', schoolId: null, hasCertificate: false })
    db.modules.push({ id: 'm1', courseId: 'c3' })
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: true, postTestCompleted: true }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c3'),
      (e) => e.statusCode === 400 && /tidak menyediakan/.test(e.message)
    )
  })

  // ------------------------------------------------
  // 12. Module tanpa stage (semua true) -> complete
  // ------------------------------------------------
  await test('Module tanpa stage tersedia -> tetap mengikuti logic existing (true)', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    // hitungStageCompletion existing mengembalikan true untuk stage
    // yang tidak tersedia; kita simulasikan itu.
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: true, postTestCompleted: true }
    const r = await service.claimCertificate('u1', 'c1')
    assert.strictEqual(r.status, 'created')
  })

  // ------------------------------------------------
  // 13. Video belum 100% -> course tidak complete
  // ------------------------------------------------
  await test('Video belum 100% -> course tidak complete', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: false, postTestCompleted: true }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400
    )
  })

  // ------------------------------------------------
  // 14. Mini-quiz lulus tapi material belum -> tidak complete
  // ------------------------------------------------
  await test('Mini-quiz lulus tapi material belum selesai -> tidak complete', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: false, postTestCompleted: true }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400
    )
  })

  // ------------------------------------------------
  // 15. Post-test belum selesai -> course tidak complete
  // ------------------------------------------------
  await test('Post-test belum memenuhi requirement -> tidak complete', async () => {
    seedBase()
    db.modules.push({ id: 'm1', courseId: 'c1' })
    stageMapMock['m1'] = { preTestCompleted: true, materialCompleted: true, postTestCompleted: false }
    await assert.rejects(
      () => service.claimCertificate('u1', 'c1'),
      (e) => e.statusCode === 400
    )
  })

  // ------------------------------------------------
  // 16. GET my certificates
  // ------------------------------------------------
  await test('GET my certificates mengembalikan data user', async () => {
    seedBase()
    modulesSelesai(['m1'])
    await service.claimCertificate('u1', 'c1')
    const list = await service.getMyCertificates('u1')
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0].courseName, 'Course A')
    assert.strictEqual(list[0].recipientName, 'Ikhsan Dwi Putra')
    assert.strictEqual(list[0].status, 'issued')
  })

  // ------------------------------------------------
  // 17. GET certificate milik user lain -> 403
  // ------------------------------------------------
  await test('GET certificate milik user lain -> 403', async () => {
    seedBase()
    modulesSelesai(['m1'])
    const r = await service.claimCertificate('u1', 'c1')
    await assert.rejects(
      () => service.getCertificateById(r.certificate.id, { id: 'lain', role: 'guru' }),
      (e) => e.statusCode === 403
    )
  })

  // ------------------------------------------------
  // 18. Idempotency race condition (P2002 fallback)
  // ------------------------------------------------
  await test('Race condition P2002 -> return existing (already_claimed)', async () => {
    seedBase()
    modulesSelesai(['m1'])
    // Pre-insert certificate, lalu paksa create throw P2002
    db.certificates.push({
      id: 'cert-x',
      userId: 'u1',
      courseId: 'c1',
      recipientName: 'Ikhsan Dwi Putra',
      nomorSertifikat: 'PANC-2026-AAAAAAAA',
      fileUrl: null,
      templateId: null,
      status: 'issued',
      issuedAt: new Date('2026-03-01T00:00:00Z'),
      createdAt: new Date('2026-03-01T00:00:00Z')
    })
    const r = await service.claimCertificate('u1', 'c1')
    assert.strictEqual(r.status, 'already_claimed')
    assert.strictEqual(db.certificates.length, 1)
  })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===\n`)

  Module._load = originalLoad
  process.exit(fail === 0 ? 0 : 1)
}

main()
