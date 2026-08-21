const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// Grouping 4 Sekolah & Wilayah (Tiap grup untuk 5 guru)
const dataSekolahWilayah = [
  { sekolah: 'SMAN 1 Bandung', kotaKab: 'Kota Bandung', kecamatan: 'Coblong' },
  { sekolah: 'SMAN 3 Bandung', kotaKab: 'Kota Bandung', kecamatan: 'Sumur Bandung' },
  { sekolah: 'SMAN 1 Bogor', kotaKab: 'Kota Bogor', kecamatan: 'Bogor Tengah' },
  { sekolah: 'SMAN 2 Depok', kotaKab: 'Kota Depok', kecamatan: 'Pancasoran Mas' }
]

// 20 Nama Guru Realistis (SMA)
const daftarGuru = [
  // SMAN 1 Bandung (5 Guru)
  { nama: 'Asep Sukandar, S.Pd.', gelar: 'S.Pd.', email: 'asep.sukandar@dummy.com' },
  { nama: 'Budi Santoso, M.Pd.', gelar: 'M.Pd.', email: 'budi.santoso@dummy.com' },
  { nama: 'Carla Citra, S.Si.', gelar: 'S.Si.', email: 'carla.citra@dummy.com' },
  { nama: 'Dewi Lestari, S.Pd.', gelar: 'S.Pd.', email: 'dewi.lestari@dummy.com' },
  { nama: 'Eko Prasetyo, M.T.', gelar: 'M.T.', email: 'eko.prasetyo@dummy.com' },

  // SMAN 3 Bandung (5 Guru)
  { nama: 'Fajar Nugraha, S.Pd.', gelar: 'S.Pd.', email: 'fajar.nugraha@dummy.com' },
  { nama: 'Gita Gutawa, M.Pd.', gelar: 'M.Pd.', email: 'gita.gutawa@dummy.com' },
  { nama: 'Hendra Wijaya, S.Kom.', gelar: 'S.Kom.', email: 'hendra.wijaya@dummy.com' },
  { nama: 'Indah Permata, S.Pd.', gelar: 'S.Pd.', email: 'indah.permata@dummy.com' },
  { nama: 'Joko Widodo, M.Si.', gelar: 'M.Si.', email: 'joko.widodo@dummy.com' },

  // SMAN 1 Bogor (5 Guru)
  { nama: 'Kartika Sari, S.Pd.', gelar: 'S.Pd.', email: 'kartika.sari@dummy.com' },
  { nama: 'Lukman Hakim, M.Pd.', gelar: 'M.Pd.', email: 'lukman.hakim@dummy.com' },
  { nama: 'Maya Angela, S.Si.', gelar: 'S.Si.', email: 'maya.angela@dummy.com' },
  { nama: 'Nurdin Abdullah, S.Pd.', gelar: 'S.Pd.', email: 'nurdin.abdullah@dummy.com' },
  { nama: 'Oky Setiana, M.Pd.', gelar: 'M.Pd.', email: 'oky.setiana@dummy.com' },

  // SMAN 2 Depok (5 Guru)
  { nama: 'Putri Rahayu, S.Pd.', gelar: 'S.Pd.', email: 'putri.rahayu@dummy.com' },
  { nama: 'Qori Sandioriva, M.Pd.', gelar: 'M.Pd.', email: 'qori.sandioriva@dummy.com' },
  { nama: 'Rian D\'Masiv, S.Sn.', gelar: 'S.Sn.', email: 'rian.dmasiv@dummy.com' },
  { nama: 'Siti Nurhaliza, S.Pd.', gelar: 'S.Pd.', email: 'siti.nurhaliza@dummy.com' },
  { nama: 'Taufik Hidayat, M.Or.', gelar: 'M.Or.', email: 'taufik.hidayat@dummy.com' }
]

async function main() {
  console.log('🧹 Menghapus data dummy lama...')

  // 1. Hapus data dummy lama (yang akhiran emailnya @example.com atau @dummy.com)
  const deleted = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@dummy.com' } }
      ]
    }
  })
  console.log(`✅ Berhasil menghapus ${deleted.count} data dummy lama.`)

  console.log('🚀 Memulai seeder data dummy baru...')

  const passwordHash = await bcrypt.hash('Password123!', 10)
  const timestampUnik = Date.now().toString().slice(-6)

  // 2. Buat 1 Akun Role Pengajar Baru
  const pengajar = await prisma.user.create({
    data: {
      nama: 'Dr. Ahmad Pengajar, M.Pd.',
      email: 'pengajar@dummy.com',
      password: passwordHash,
      role: 'pengajar',
      gelar: 'M.Pd.',
      nip: `19850101201001${timestampUnik}`,
      sekolah: 'Dinas Pendidikan Jawa Barat',
      kotaKab: 'Kota Bandung',
      kecamatan: 'Sumur Bandung',
      noHp: '081234567890',
      isVerified: true,
      status: 'aktif'
    }
  })
  console.log(`✅ Account Pengajar dibuat: ${pengajar.email}`)

  // 3. Buat 20 Data Dummy Guru SMA Baru
  for (let i = 0; i < daftarGuru.length; i++) {
    const guru = daftarGuru[i]
    // Menentukan lokasi/sekolah (setiap 5 guru beda sekolah/wilayah)
    const wilayahIndex = Math.floor(i / 5)
    const wilayah = dataSekolahWilayah[wilayahIndex]
    
    const indexStr = (i + 1) < 10 ? '0' + (i + 1) : (i + 1)
    const nipDummy = `199001012023${timestampUnik}${indexStr}`

    await prisma.user.create({
      data: {
        nama: guru.nama,
        email: guru.email,
        password: passwordHash,
        role: 'guru',
        gelar: guru.gelar,
        nip: nipDummy,
        sekolah: wilayah.sekolah,
        kotaKab: wilayah.kotaKab,
        kecamatan: wilayah.kecamatan,
        noHp: `0852112233${indexStr}`,
        isVerified: true,
        status: 'aktif'
      }
    })
  }

  console.log('🎉 20 Data Dummy Guru SMA baru berhasil dibuat!')
}

main()
  .catch((e) => {
    console.error('❌ Gagal memperbarui data dummy:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })