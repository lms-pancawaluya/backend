// test/certificate-generation.test.js
//
// Test standalone untuk fitur Certificate Template & PDF Generation.
// Tidak memakai framework (repo tidak memilikinya) dan TIDAK
// menyentuh database maupun storage eksternal.
// Prisma, upload.service, dan certificate-pdf.service di-mock.
//
// Jalankan: node test/certificate-generation.test.js

const assert = require('assert')
const path = require('path')
const Module = require('module')

// ================================================
// Mock store in-memory
// ================================================
let db = {
  users: [],
  courses: [],
  certificates: []
}

let uploadedTemplates = {}
let uploadedCertificates = {}
let templateBytes = Buffer.from('%PDF-1.7 fake template')

// ================================================
// Mock Prisma
// ================================================
const mockPrisma = {
  course: {
    findUnique: async ({ where }) => {
      const c = db.courses.find((x) => x.id === where.id)
      return c ? { ...c } : null
    },
    update: async ({ where, data }) => {
      const c = db.courses.find((x) => x.id === where.id)
      if (!c) throw new Error('not found')
      Object.assign(c, data)
      return { ...c }
    }
  },
  certificate: {
    findUnique: async ({ where }) => {
      const c = db.certificates.find((x) => x.id === where.id)
      if (!c) return null
      return {
        ...c,
        course: db.courses.find((k) => k.id === c.courseId) || null
      }
    },
    update: async ({ where, data }) => {
      const c = db.certificates.find((x) => x.id === where.id)
      if (!c) throw new Error('not found')
      Object.assign(c, data)
      return {
        ...c,
        course: db.courses.find((k) => k.id === c.courseId) || null
      }
    }
  }
}

// ================================================
// Mock upload.service
// ================================================
const mockUploadService = {
  uploadCertificateTemplate: async (file, courseId) => {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new Error('Template sertifikat wajib berformat PDF!')
    }
    const url = `https://res.cloudinary.com/demo/raw/upload/lms-certificate-templates/template-${courseId}.pdf`
    const publicId = `lms-certificate-templates/template-${courseId}`
    uploadedTemplates[courseId] = url
    return { url, publicId }
  },
  uploadCertificateFile: async (pdfBuffer, certificateNumber) => {
    const url = `https://res.cloudinary.com/demo/raw/upload/lms-certificates/certificate-${certificateNumber}.pdf`
    uploadedCertificates[certificateNumber] = url
    return url
  },
  downloadFileBuffer: async (url) => {
    if (!url) throw new Error('url kosong')
    return templateBytes
  }
}

// ================================================
// Mock certificate-pdf.service
// ================================================
let lastOverlayArgs = null
const mockPdfService = {
  generateCertificatePdf: async (args) => {
    lastOverlayArgs = args
    return Buffer.from('%PDF-1.7 generated certificate')
  }
}

// ================================================
// Intercept require
// ================================================
const dbPath = path.resolve(__dirname, '../src/config/database.js')
const uploadPath = path.resolve(
  __dirname,
  '../src/modules/upload/upload.service.js'
)
const pdfPath = path.resolve(
  __dirname,
  '../src/modules/certificates/certificate-pdf.service.js'
)

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === dbPath) return mockPrisma
  if (resolved === uploadPath) return mockUploadService
  if (resolved === pdfPath) return mockPdfService
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

function reset() {
  db = { users: [], courses: [], certificates: [] }
  uploadedTemplates = {}
  uploadedCertificates = {}
  lastOverlayArgs = null
}

const ADMIN = { id: 'admin1', nama: 'Admin', role: 'admin', schoolId: null }
const GURU = { id: 'u1', nama: 'Ikhsan Dwi Putra', role: 'guru', schoolId: 'sch1' }
const GURU2 = { id: 'u2', nama: 'Guru Lain', role: 'guru', schoolId: 'sch2' }

const COURSE = {
  id: 'c1',
  judul: 'Course A',
  schoolId: null,
  hasCertificate: true,
  certificateTemplateUrl: null,
  certificateTemplateId: null,
  certificateOverlay: null
}

function seedBase() {
  reset()
  db.users.push({ ...ADMIN }, { ...GURU }, { ...GURU2 })
  db.courses.push({ ...COURSE })
}

function seedCertificate(overrides = {}) {
  const cert = {
    id: 'cert-1',
    userId: 'u1',
    courseId: 'c1',
    recipientName: 'Ikhsan Dwi Putra',
    nomorSertifikat: 'PANC-2026-ABCD1234',
    fileUrl: null,
    templateId: null,
    status: 'issued',
    issuedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides
  }
  db.certificates.push(cert)
  return cert
}

async function main() {
  console.log('\n=== CERTIFICATE TEMPLATE & GENERATION TESTS ===\n')

  // ------------------------------------------------
  // 1. Admin upload template
  // ------------------------------------------------
  await test('Admin dapat upload template PDF', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    const r = await service.uploadCertificateTemplate('c1', file, ADMIN)
    assert.ok(r.certificateTemplateUrl, 'templateUrl terisi')
    assert.ok(r.certificateTemplateId, 'templateId terisi')
    assert.strictEqual(
      db.courses[0].certificateTemplateUrl,
      r.certificateTemplateUrl
    )
  })

  // ------------------------------------------------
  // 2. Template tersimpan di storage (Cloudinary url)
  // ------------------------------------------------
  await test('Template tersimpan di storage (URL Cloudinary)', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    assert.match(
      db.courses[0].certificateTemplateUrl,
      /res\.cloudinary\.com/
    )
  })

  // ------------------------------------------------
  // 3. Template terhubung ke course
  // ------------------------------------------------
  await test('Template terhubung ke course (courseId)', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    const tpl = await service.getCertificateTemplate('c1', GURU)
    assert.strictEqual(tpl.courseId, 'c1')
    assert.strictEqual(tpl.hasTemplate, true)
  })

  // ------------------------------------------------
  // 4. Non-PDF ditolak
  // ------------------------------------------------
  await test('Upload non-PDF ditolak', async () => {
    seedBase()
    const file = { mimetype: 'image/png', buffer: Buffer.from('x') }
    await assert.rejects(
      () => service.uploadCertificateTemplate('c1', file, ADMIN),
      /berformat PDF/
    )
  })

  // ------------------------------------------------
  // 5. Non-admin tidak boleh kelola course sekolah lain
  // ------------------------------------------------
  await test('Non-admin tidak boleh upload template course sekolah lain (403)', async () => {
    reset()
    db.users.push({ ...ADMIN }, { ...GURU2 })
    db.courses.push({ ...COURSE, schoolId: 'sch1' })
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await assert.rejects(
      () => service.uploadCertificateTemplate('c1', file, GURU2),
      (e) => e.statusCode === 403
    )
  })

  // ------------------------------------------------
  // 6. Course tanpa template -> generate ditolak
  // ------------------------------------------------
  await test('Course tanpa template -> generate ditolak (400)', async () => {
    seedBase()
    seedCertificate()
    await assert.rejects(
      () => service.generateCertificate('cert-1', GURU),
      (e) =>
        e.statusCode === 400 &&
        /belum memiliki template/.test(e.message)
    )
    assert.strictEqual(db.certificates[0].fileUrl, null)
  })

  // ------------------------------------------------
  // 7. Generate sukses menggunakan template course
  // ------------------------------------------------
  await test('Generate certificate sukses memakai template course', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate()
    const r = await service.generateCertificate('cert-1', GURU)
    assert.strictEqual(r.status, 'generated')
    assert.ok(r.certificate.fileUrl, 'fileUrl terisi')
    assert.strictEqual(db.certificates[0].fileUrl, r.certificate.fileUrl)
    assert.strictEqual(db.certificates[0].status, 'generated')
  })

  // ------------------------------------------------
  // 8. recipientName dari certificate snapshot
  // ------------------------------------------------
  await test('recipientName diambil dari certificate snapshot', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate({ recipientName: 'Nama Snapshot Lama' })
    // ganti nama user -> generate tetap pakai snapshot
    await service.generateCertificate('cert-1', GURU)
    assert.strictEqual(
      lastOverlayArgs.data.recipientName,
      'Nama Snapshot Lama'
    )
  })

  // ------------------------------------------------
  // 9. generated PDF tersimpan & fileUrl terisi
  // ------------------------------------------------
  await test('Generated PDF tersimpan di storage & fileUrl terisi', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate()
    const r = await service.generateCertificate('cert-1', GURU)
    assert.match(
      r.certificate.fileUrl,
      /res\.cloudinary\.com/
    )
    assert.ok(
      uploadedCertificates['PANC-2026-ABCD1234'],
      'file personal terupload'
    )
  })

  // ------------------------------------------------
  // 10. Certificate user lain tidak dapat diakses
  // ------------------------------------------------
  await test('Certificate user lain tidak dapat digenerate (403)', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate()
    await assert.rejects(
      () => service.generateCertificate('cert-1', GURU2),
      (e) => e.statusCode === 403
    )
  })

  // ------------------------------------------------
  // 11. fileUrl sudah ada -> tidak generate ulang
  // ------------------------------------------------
  await test('Certificate yang sudah punya fileUrl tidak digenerate ulang', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate({ fileUrl: 'https://existing/file.pdf' })
    const r = await service.generateCertificate('cert-1', GURU)
    assert.strictEqual(r.status, 'already_generated')
    assert.strictEqual(r.certificate.fileUrl, 'https://existing/file.pdf')
    // pdf service tidak dipanggil
    assert.strictEqual(lastOverlayArgs, null)
  })

  // ------------------------------------------------
  // 12. force = true -> generate ulang eksplisit
  // ------------------------------------------------
  await test('force=true generate ulang eksplisit', async () => {
    seedBase()
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate({ fileUrl: 'https://existing/file.pdf' })
    const r = await service.generateCertificate('cert-1', GURU, {
      force: true
    })
    assert.strictEqual(r.status, 'generated')
    assert.notStrictEqual(
      r.certificate.fileUrl,
      'https://existing/file.pdf'
    )
  })

  // ------------------------------------------------
  // 13. Certificate tidak ditemukan -> 404
  // ------------------------------------------------
  await test('Certificate tidak ditemukan -> 404', async () => {
    seedBase()
    await assert.rejects(
      () => service.generateCertificate('tidak-ada', GURU),
      (e) => e.statusCode === 404
    )
  })

  // ------------------------------------------------
  // 14. getCertificateTemplate course tidak ada -> 404
  // ------------------------------------------------
  await test('getCertificateTemplate course tidak ada -> 404', async () => {
    seedBase()
    await assert.rejects(
      () => service.getCertificateTemplate('tidak-ada', GURU),
      (e) => e.statusCode === 404
    )
  })

  // ------------------------------------------------
  // 15. Overlay config diteruskan ke pdf service
  // ------------------------------------------------
  await test('Overlay config course diteruskan ke pdf service', async () => {
    seedBase()
    db.courses[0].certificateOverlay = {
      name: { x: 0.5, y: 0.4, fontSize: 40 }
    }
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') }
    await service.uploadCertificateTemplate('c1', file, ADMIN)
    seedCertificate()
    await service.generateCertificate('cert-1', GURU)
    assert.deepStrictEqual(
      lastOverlayArgs.overlayConfig,
      { name: { x: 0.5, y: 0.4, fontSize: 40 } }
    )
  })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===\n`)

  Module._load = originalLoad
  process.exit(fail === 0 ? 0 : 1)
}

main()
