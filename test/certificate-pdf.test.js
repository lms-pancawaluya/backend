// test/certificate-pdf.test.js
//
// Test standalone untuk rendering PDF sertifikat
// (certificate-pdf.service.js) menggunakan pdf-lib asli.
//
// Fokus: default positioning pada template TANPA
// certificateOverlay (admin tidak perlu isi manual), dan
// auto-shrink nama panjang agar tidak overflow.
//
// Template uji dibuat secara sintetis (landscape, 1 halaman)
// agar test mandiri dan tidak bergantung file eksternal.
//
// Jalankan: node test/certificate-pdf.test.js

const assert = require('assert')
const { PDFDocument, StandardFonts } = require('pdf-lib')

const pdfService = require('../src/modules/certificates/certificate-pdf.service')

// ================================================
// Buat template landscape syntetis (ukuran ~A4 landscape)
// ================================================
const WIDTH = 842.25
const HEIGHT = 595.5

const buatTemplate = async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([WIDTH, HEIGHT])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('TEMPLATE BACKGROUND', {
    x: 40,
    y: HEIGHT - 60,
    size: 24,
    font
  })
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

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
// HELPER — Ekstrak text yang tergambar pada PDF hasil.
// pdf-lib tidak menyediakan reader; kita cukup verifikasi
// ukuran halaman & keberadaan halaman, lalu uji positioning
// lewat fungsi normalizeOverlay + fitFontSize (unit-level).
// ================================================
async function main() {
  console.log('\n=== CERTIFICATE PDF RENDERING TESTS ===\n')

  // ------------------------------------------------
  // 1. Template tanpa certificateOverlay tetap
  //    menghasilkan PDF (default positioning).
  // ------------------------------------------------
  await test('Template tanpa certificateOverlay tetap menghasilkan PDF', async () => {
    const template = await buatTemplate()

    const out = await pdfService.generateCertificatePdf({
      templatePdfBuffer: template,
      overlayConfig: null, // <-- admin tidak mengisi apa pun
      data: {
        recipientName: 'Ikhsan Dwi Putra',
        certificateNumber: 'PANC-2026-ABCD1234',
        issuedAt: new Date('2026-03-01T00:00:00Z'),
        courseName: 'Course A'
      }
    })

    assert.ok(Buffer.isBuffer(out), 'output harus Buffer')
    assert.ok(out.length > 0, 'output tidak boleh kosong')
    assert.strictEqual(
      out.slice(0, 5).toString(),
      '%PDF-',
      'output harus PDF valid'
    )
  })

  // ------------------------------------------------
  // 2. Hasil tetap 1 halaman & landscape (background
  //    template utuh).
  // ------------------------------------------------
  await test('Hasil 1 halaman landscape (template dipertahankan)', async () => {
    const template = await buatTemplate()

    const out = await pdfService.generateCertificatePdf({
      templatePdfBuffer: template,
      overlayConfig: null,
      data: {
        recipientName: 'Guru Contoh',
        certificateNumber: 'PANC-2026-11112222',
        issuedAt: new Date('2026-03-01T00:00:00Z'),
        courseName: 'Course A'
      }
    })

    const re = await PDFDocument.load(out)
    assert.strictEqual(re.getPageCount(), 1, 'harus 1 halaman')

    const { width, height } = re.getPage(0).getSize()
    assert.strictEqual(width, WIDTH, 'lebar dipertahankan')
    assert.strictEqual(height, HEIGHT, 'tinggi dipertahankan')
    assert.ok(width > height, 'harus landscape')
  })

  // ------------------------------------------------
  // 3. recipientName memakai DEFAULT positioning saat
  //    overlay kosong (center horizontal).
  // ------------------------------------------------
  await test('recipientName memakai default positioning (center)', async () => {
    const normalized = pdfService.normalizeOverlay(null)

    assert.strictEqual(normalized.name.x, 0.5, 'x default = center')
    assert.strictEqual(
      normalized.name.align,
      'center',
      'align default = center'
    )
    assert.strictEqual(
      normalized.name.y,
      pdfService.DEFAULT_OVERLAY.name.y,
      'y memakai default template'
    )

    // Field opsional TIDAK diaktifkan tanpa konfigurasi.
    assert.strictEqual(normalized.number, null)
    assert.strictEqual(normalized.date, null)
    assert.strictEqual(normalized.courseName, null)
  })

  // ------------------------------------------------
  // 4. Nama panjang auto-shrink agar tidak overflow.
  // ------------------------------------------------
  await test('Nama panjang auto-shrink (tidak overflow)', async () => {
    const template = await buatTemplate()

    const namaPanjang =
      'Dr. Muhammad Rizky Pratama Wijaya Kusuma S.H., M.Pd. Ph.D.'

    // Render nyata: tidak boleh throw dan menghasilkan PDF.
    const out = await pdfService.generateCertificatePdf({
      templatePdfBuffer: template,
      overlayConfig: null,
      data: {
        recipientName: namaPanjang,
        certificateNumber: 'PANC-2026-33334444',
        issuedAt: new Date('2026-03-01T00:00:00Z'),
        courseName: 'Course A'
      }
    })
    assert.ok(out.slice(0, 5).toString() === '%PDF-')

    // Verifikasi auto-shrink secara unit: font pada nama panjang
    // harus mengecil agar lebar text <= maxWidth area.
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.HelveticaBold)

    const maxWidth =
      WIDTH * pdfService.DEFAULT_OVERLAY.name.maxWidthPercent

    const size = pdfService.fitFontSize(
      font,
      namaPanjang,
      pdfService.DEFAULT_OVERLAY.name.fontSize,
      maxWidth
    )

    const lebarText = font.widthOfTextAtSize(namaPanjang, size)

    assert.ok(
      size < pdfService.DEFAULT_OVERLAY.name.fontSize,
      'font harus mengecil untuk nama panjang'
    )
    assert.ok(
      lebarText <= maxWidth,
      `lebar text (${lebarText.toFixed(1)}) harus <= area (${maxWidth.toFixed(1)})`
    )
  })

  // ------------------------------------------------
  // 5. Konfigurasi overlay custom tetap dihormati
  //    (future flexibility dipertahankan).
  // ------------------------------------------------
  await test('certificateOverlay custom tetap dihormati', async () => {
    const normalized = pdfService.normalizeOverlay({
      name: { x: 0.3, y: 0.6, fontSize: 30, align: 'left' }
    })

    assert.strictEqual(normalized.name.x, 0.3)
    assert.strictEqual(normalized.name.y, 0.6)
    assert.strictEqual(normalized.name.fontSize, 30)
    assert.strictEqual(normalized.name.align, 'left')
  })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main()
