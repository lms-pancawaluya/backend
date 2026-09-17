// src/modules/certificates/certificate-pdf.service.js
//
// Helper generasi PDF sertifikat.
//
// Prinsip:
// - Template PDF (hasil export Canva) diambil apa adanya sebagai
//   background/halaman. Backend TIDAK membuat desain baru.
// - Ukuran halaman, orientasi, background, dekorasi, dan layout
//   template dipertahankan (halaman template tetap utuh, kita hanya
//   menggambar text overlay di atasnya).
// - Text overlay: nama penerima (wajib), plus nomor sertifikat,
//   tanggal penerbitan, dan nama course BILA area overlay disediakan.
//
// Posisi overlay memakai koordinat RELATIF (persen dari lebar/tinggi
// halaman) agar tidak bergantung pada ukuran halaman template.
// Konfigurasi berasal dari kolom Course.certificateOverlay (Json,
// opsional). Bila tidak diisi, dipakai default yang wajar (nama
// berada di tengah area bawah).

const {
  PDFDocument,
  StandardFonts,
  rgb
} = require('pdf-lib')

// ================================================
// DEFAULT OVERLAY (persen)
//
// Dipakai ketika Course.certificateOverlay kosong,
// sehingga admin TIDAK perlu mengisi konfigurasi
// manual di database agar template langsung usable.
//
// Nilai default disetel berdasarkan layout template
// referensi Canva:
//   "Oranye Merah Minimalist Organic Certificate of Recognition.pdf"
//   (1 halaman, landscape, 842.25 x 595.5 pt)
// di mana area nama berada di tengah halaman, di
// bawah subjudul "SERTIFIKAT INI DIBERIKAN KEPADA".
//
// x: titik tengah horizontal relatif (0-1)
// y: titik tengah vertikal relatif (0-1), 0 = bawah halaman
// maxWidthPercent: lebar maksimum area text relatif terhadap lebar halaman
// fontSize: ukuran dasar (pt) sebelum auto-shrink
// color: [r, g, b] 0-1
// ================================================
const DEFAULT_OVERLAY = {
  name: {
    x: 0.5, // center horizontal
    y: 0.535, // area nama template referensi
    maxWidthPercent: 0.7,
    fontSize: 44,
    color: [0.15, 0.1, 0.05],
    align: 'center'
  },
  // Elemen opsional hanya di-overlay bila admin
  // menyediakan area/konfigurasinya (tidak dipaksa).
  number: null,
  date: null,
  courseName: null
}

// ================================================
// HELPER — Normalisasi input konfigurasi menjadi
// struktur yang aman dipakai (fallback ke default).
// ================================================
const angka = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const normalizeOverlay = (raw) => {
  const config = raw && typeof raw === 'object' ? raw : {}

  const build = (key, fallback) => {
    const source = config[key]
    if (!source || typeof source !== 'object') {
      return fallback
    }

    return {
      x: angka(source.x, fallback.x),
      y: angka(source.y, fallback.y),
      maxWidthPercent: angka(
        source.maxWidthPercent,
        fallback.maxWidthPercent
      ),
      fontSize: angka(source.fontSize, fallback.fontSize),
      color: Array.isArray(source.color)
        ? source.color
        : fallback.color,
      align: source.align || fallback.align
    }
  }

  // name wajib punya posisi; utamakan config bila ada.
  const name = build('name', DEFAULT_OVERLAY.name)

  return {
    name,
    // Field opsional: hanya dipakai bila admin menyediakan posisinya.
    number: config.number ? build('number', name) : null,
    date: config.date ? build('date', name) : null,
    courseName: config.courseName
      ? build('courseName', name)
      : null
  }
}

// ================================================
// HELPER — Auto-shrink font agar text muat dalam
// lebar area (requirement: font menyesuaikan bila
// nama terlalu panjang).
// ================================================
const fitFontSize = (font, text, baseSize, maxWidth) => {
  let size = baseSize
  const minSize = 10

  while (size > minSize) {
    const width = font.widthOfTextAtSize(text, size)
    if (width <= maxWidth) {
      return size
    }
    size -= 1
  }

  return minSize
}

// ================================================
// HELPER — Gambar satu baris text overlay pada posisi
// relatif (persen) dari ukuran halaman.
// ================================================
const drawOverlay = (
  page,
  font,
  text,
  pos,
  color
) => {
  if (!text) return

  const { width, height } = page.getSize()

  const maxWidth = width * pos.maxWidthPercent

  const size = fitFontSize(
    font,
    text,
    pos.fontSize,
    maxWidth
  )

  const textWidth = font.widthOfTextAtSize(text, size)

  // Titik tengah text pada koordinat halaman.
  const centerX = width * pos.x
  const centerY = height * pos.y

  let x = centerX - textWidth / 2

  if (pos.align === 'left') {
    x = centerX
  } else if (pos.align === 'right') {
    x = centerX - textWidth
  }

  page.drawText(text, {
    x,
    y: centerY,
    size,
    font,
    color: rgb(
      color[0] ?? 0,
      color[1] ?? 0,
      color[2] ?? 0
    )
  })
}

// ================================================
// FORMAT TANGGAL — dd Month yyyy (locale Indonesia
// tidak diandalkan agar konsisten lintas runtime).
// ================================================
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

const formatTanggal = (date) => {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

// ================================================
// GENERATE CERTIFICATE PDF
//
// Input:
// - templatePdfBuffer: Buffer PDF template (dari Cloudinary).
// - overlayConfig: Course.certificateOverlay (opsional).
// - data: { recipientName, certificateNumber, issuedAt, courseName }
//
// Output: Buffer PDF personal (template + overlay).
// ================================================
const generateCertificatePdf = async ({
  templatePdfBuffer,
  overlayConfig,
  data
}) => {
  if (!templatePdfBuffer) {
    throw new Error('Template PDF sertifikat tidak tersedia')
  }

  // Muat template sebagai background (halaman template dipertahankan).
  const pdfDoc = await PDFDocument.load(templatePdfBuffer, {
    ignoreEncryption: true
  })

  const pages = pdfDoc.getPages()

  if (pages.length === 0) {
    throw new Error('Template PDF tidak memiliki halaman')
  }

  const font = await pdfDoc.embedFont(
    StandardFonts.HelveticaBold
  )

  const overlay = normalizeOverlay(overlayConfig)

  // Overlay ditempel pada halaman PERTAMA template.
  const page = pages[0]

  // Nama penerima (wajib).
  drawOverlay(
    page,
    font,
    data.recipientName,
    overlay.name,
    overlay.name.color
  )

  // Field opsional — hanya bila admin menyediakan area.
  if (overlay.number && data.certificateNumber) {
    drawOverlay(
      page,
      font,
      data.certificateNumber,
      overlay.number,
      overlay.number.color
    )
  }

  if (overlay.date && data.issuedAt) {
    drawOverlay(
      page,
      font,
      formatTanggal(data.issuedAt),
      overlay.date,
      overlay.date.color
    )
  }

  if (overlay.courseName && data.courseName) {
    drawOverlay(
      page,
      font,
      data.courseName,
      overlay.courseName,
      overlay.courseName.color
    )
  }

  const bytes = await pdfDoc.save()

  return Buffer.from(bytes)
}

module.exports = {
  generateCertificatePdf,
  normalizeOverlay,
  formatTanggal,
  // diekspor untuk kebutuhan pengujian default positioning
  DEFAULT_OVERLAY,
  fitFontSize
}
