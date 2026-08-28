const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const prisma = new PrismaClient()

// Fungsi untuk membersihkan nama sekolah agar menjadi format "SMA Negeri X" atau "SMA Swasta X"
function formatNamaSekolah(nama) {
  if (!nama) return ''
  let cleaned = nama.trim()
  if (cleaned.startsWith('SMAN ')) {
    return cleaned.replace('SMAN ', 'SMA Negeri ')
  }
  if (cleaned.startsWith('SMAS ')) {
    return cleaned.replace('SMAS ', 'SMA Swasta ')
  }
  return cleaned
}

// Fungsi helper untuk merapikan nama Kota/Kabupaten
function formatKotaKab(val) {
  if (!val) return 'Kab. Bandung'
  let cleaned = val.trim()

  // Jika sudah berawalan "Kota" atau "KOTA"
  if (/^kota\b/i.test(cleaned)) {
    return cleaned.replace(/^kota\b/i, 'Kota')
  }

  // Jika sudah berawalan "Kab." atau "KAB."
  if (/^kab\./i.test(cleaned)) {
    return cleaned.replace(/^kab\./i, 'Kab.')
  }

  // Jika sudah berawalan "Kabupaten"
  if (/^kabupaten\b/i.test(cleaned)) {
    return cleaned.replace(/^kabupaten\b/i, 'Kab.')
  }

  // Jika belum ada awalan sama sekali
  return `Kab. ${cleaned}`
}

// Fungsi helper untuk merapikan nama Kecamatan
function formatKecamatan(val) {
  if (!val) return null
  let cleaned = val.trim()

  // Jika sudah berawalan "Kec." atau "KEC."
  if (/^kec\./i.test(cleaned)) {
    return cleaned.replace(/^kec\./i, 'Kec.')
  }

  // Jika sudah berawalan "Kecamatan"
  if (/^kecamatan\b/i.test(cleaned)) {
    return cleaned.replace(/^kecamatan\b/i, 'Kec.')
  }

  // Jika belum ada awalan sama sekali
  return `Kec. ${cleaned}`
}

async function main() {
  console.log('🌱 Memulai proses impor data sekolah dari CSV...')

  const csvFilePath = path.join(__dirname, '../sekolah.csv')

  if (!fs.existsSync(csvFilePath)) {
    console.error('❌ File sekolah.csv tidak ditemukan di root folder backend!')
    process.exit(1)
  }

  const fileStream = fs.createReadStream(csvFilePath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let lineCount = 0
  const sekolahBatch = []

  for await (const line of rl) {
    lineCount++
    // Lewati 3 baris pertama (header dokumen CSV)
    if (lineCount <= 3) continue

    // Split baris CSV berdasarkan koma
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim())

    const namaSekolahRaw = cols[0]
    const npsn = cols[1]
    const bentuk = cols[2]
    const desaKelurahan = cols[4]
    const kecamatan = cols[5]
    const kotaKab = cols[6]
    const status = cols[11]
    const akreditasi = cols[12]

    if (npsn && namaSekolahRaw) {
      sekolahBatch.push({
        npsn: npsn,
        nama: formatNamaSekolah(namaSekolahRaw),
        bentuk: bentuk || 'SMA',
        kotaKab: formatKotaKab(kotaKab),
        kecamatan: formatKecamatan(kecamatan),
        desaKelurahan: desaKelurahan || null,
        status: status || 'NEGERI',
        akreditasi: akreditasi || 'A'
      })
    }
  }

  console.log(`📦 Memproses ${sekolahBatch.length} data sekolah ke database...`)

  // Gunakan createMany dengan skipDuplicates agar aman jika di-run berkali-kali
  await prisma.masterSekolah.createMany({
    data: sekolahBatch,
    skipDuplicates: true
  })

  console.log('✅ Berhasil mengimpor seluruh data Master Sekolah!')

  // -------------------------------------------------------------
  // SEED DATA DUMMY GURU
  // -------------------------------------------------------------
  console.log('🌱 Membuat data dummy Master Guru...')

  const sampleSekolah = await prisma.masterSekolah.findMany({ take: 5 })

  if (sampleSekolah.length > 0) {
    const dummyGuruList = [
      {
        nip: '198501012010011001',
        namaGuru: 'Asep Sunandar, S.Pd.',
        npsnSekolah: sampleSekolah[0].npsn || '20206151',
        namaSekolah: sampleSekolah[0].nama,
        kotaKab: sampleSekolah[0].kotaKab,
        kecamatan: sampleSekolah[0].kecamatan
      },
      {
        nip: '199002152015022002',
        namaGuru: 'Siti Nurhaliza, M.Pd.',
        npsnSekolah: sampleSekolah[1]?.npsn || '20203001',
        namaSekolah: sampleSekolah[1]?.nama || 'SMA Negeri 3 Bandung',
        kotaKab: sampleSekolah[1]?.kotaKab || 'Kota Bandung',
        kecamatan: sampleSekolah[1]?.kecamatan || 'Kec. Sumur Bandung'
      },
      {
        nip: '198803122014011003',
        namaGuru: 'Budi Santoso, S.Si.',
        npsnSekolah: sampleSekolah[2]?.npsn || '20206152',
        namaSekolah: sampleSekolah[2]?.nama || 'SMA Negeri 2 Baleendah',
        kotaKab: sampleSekolah[2]?.kotaKab || 'Kab. Bandung',
        kecamatan: sampleSekolah[2]?.kecamatan || 'Kec. Baleendah'
      },
      {
        nip: '199207042019032004',
        namaGuru: 'Dewi Lestari, S.Kom.',
        npsnSekolah: sampleSekolah[3]?.npsn || '20251791',
        namaSekolah: sampleSekolah[3]?.nama || 'SMA Negeri 1 Banjaran',
        kotaKab: sampleSekolah[3]?.kotaKab || 'Kab. Bandung',
        kecamatan: sampleSekolah[3]?.kecamatan || 'Kec. Banjaran'
      }
    ]

    await prisma.masterGuru.createMany({
      data: dummyGuruList,
      skipDuplicates: true
    })

    console.log('✅ Data dummy Master Guru berhasil di-seed!')
  }
}

main()
  .catch((e) => {
    console.error('❌ Error saat seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })