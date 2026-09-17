const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  // =====================================================
  // CONFIG
  // =====================================================

  const PASSWORD = 'Password123!'
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // =====================================================
  // HAPUS USER DUMMY LAMA
  // =====================================================

  console.log('🧹 Menghapus data dummy user lama...')

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        {
          email: {
            endsWith: '@example.com'
          }
        },
        {
          email: {
            endsWith: '@dummy.com'
          }
        },
        {
          email: {
            in: [
              'admin@dummy.com',
              'pengajar@dummy.com'
            ]
          }
        }
      ]
    }
  })

  console.log(
    `✅ Berhasil menghapus ${deletedUsers.count} data dummy lama.`
  )

  // =====================================================
  // AMBIL DATA MASTER SEKOLAH
  // =====================================================

  console.log('🔎 Mengambil sekolah dari master_sekolah...')

  const sekolahDummy = await prisma.masterSekolah.findMany({
    take: 4,

    orderBy: {
      nama: 'asc'
    },

    select: {
      id: true,
      npsn: true,
      nama: true,
      kotaKab: true,
      kecamatan: true
    }
  })

  if (sekolahDummy.length < 4) {
    throw new Error(
      `Data master_sekolah tidak cukup. Ditemukan ${sekolahDummy.length} sekolah, minimal membutuhkan 4 sekolah.`
    )
  }

  console.log('🏫 Sekolah yang digunakan untuk akun dummy:')

  sekolahDummy.forEach((sekolah, index) => {
    console.log(
      `   ${index + 1}. ${sekolah.nama} | NPSN: ${sekolah.npsn} | UUID: ${sekolah.id}`
    )
  })

  // =====================================================
  // ADMIN
  // =====================================================

  console.log('')
  console.log('👤 Membuat account Admin...')

  const admin = await prisma.user.create({
    data: {
      email: 'admin@dummy.com',
      password: passwordHash,
      nama: 'Administrator Dummy',
      role: 'admin',

      // Admin bersifat GLOBAL
      schoolId: null,

      sekolah: 'Dinas Pendidikan Provinsi Jawa Barat',
      kotaKab: 'Bandung',
      kecamatan: null,
      status: 'aktif'
    }
  })

  console.log(`✅ Account Admin dibuat: ${admin.email}`)

  // =====================================================
  // PENGAJAR
  // =====================================================

  console.log('')
  console.log('👨‍🏫 Membuat account Pengajar...')

  // Pengajar menggunakan sekolah pertama dari master_sekolah
  const sekolahPengajar = sekolahDummy[0]

  const pengajar = await prisma.user.create({
    data: {
      email: 'pengajar@dummy.com',
      password: passwordHash,
      nama: 'Pengajar Dummy',
      role: 'pengajar',

      // schoolId = UUID master_sekolah.id
      schoolId: sekolahPengajar.id,

      // Informasi sekolah untuk kebutuhan profile/display
      sekolah: sekolahPengajar.nama,
      kotaKab: sekolahPengajar.kotaKab,
      kecamatan: sekolahPengajar.kecamatan,

      status: 'aktif'
    }
  })

  console.log(
    `✅ Account Pengajar dibuat: ${pengajar.email}`
  )

  console.log(
    `   🏫 Sekolah: ${sekolahPengajar.nama}`
  )

  console.log(
    `   🆔 School ID: ${sekolahPengajar.id}`
  )

  console.log(
    `   🔢 NPSN: ${sekolahPengajar.npsn}`
  )

  // =====================================================
  // GURU DUMMY
  // =====================================================

  console.log('')
  console.log('👨‍🏫 Membuat account Guru dummy...')

  const daftarGuru = [
    {
      nama: 'Asep Sukandar',
      email: 'asep.sukandar@dummy.com'
    },
    {
      nama: 'Dedi Supriyadi',
      email: 'dedi.supriyadi@dummy.com'
    },
    {
      nama: 'Rina Marlina',
      email: 'rina.marlina@dummy.com'
    },
    {
      nama: 'Siti Rahmawati',
      email: 'siti.rahmawati@dummy.com'
    },
    {
      nama: 'Budi Santoso',
      email: 'budi.santoso@dummy.com'
    },
    {
      nama: 'Dewi Lestari',
      email: 'dewi.lestari@dummy.com'
    },
    {
      nama: 'Andi Setiawan',
      email: 'andi.setiawan@dummy.com'
    },
    {
      nama: 'Novi Anggraini',
      email: 'novi.anggraini@dummy.com'
    },
    {
      nama: 'Fajar Hidayat',
      email: 'fajar.hidayat@dummy.com'
    },
    {
      nama: 'Rizky Ramadhan',
      email: 'rizky.ramadhan@dummy.com'
    },
    {
      nama: 'Dian Permatasari',
      email: 'dian.permatasari@dummy.com'
    },
    {
      nama: 'Agus Setiawan',
      email: 'agus.setiawan@dummy.com'
    },
    {
      nama: 'Nina Kurniawati',
      email: 'nina.kurniawati@dummy.com'
    },
    {
      nama: 'Hendra Wijaya',
      email: 'hendra.wijaya@dummy.com'
    },
    {
      nama: 'Lina Marlina',
      email: 'lina.marlina@dummy.com'
    },
    {
      nama: 'Yudi Hartono',
      email: 'yudi.hartono@dummy.com'
    },
    {
      nama: 'Maya Sari',
      email: 'maya.sari@dummy.com'
    },
    {
      nama: 'Rudi Hermawan',
      email: 'rudi.hermawan@dummy.com'
    },
    {
      nama: 'Putri Amelia',
      email: 'putri.amelia@dummy.com'
    },
    {
      nama: 'Wahyu Setiawan',
      email: 'wahyu.setiawan@dummy.com'
    }
  ]

  for (let i = 0; i < daftarGuru.length; i++) {
    const guru = daftarGuru[i]

    // Guru dibagi ke 4 sekolah secara bergantian
    const sekolahGuru =
      sekolahDummy[i % sekolahDummy.length]

    // NIP dummy
    const nip =
      `199001012023${String(i + 1).padStart(2, '0')}`

    await prisma.user.create({
      data: {
        email: guru.email,
        password: passwordHash,
        nama: guru.nama,
        role: 'guru',
        nip,

        // schoolId menggunakan UUID dari master_sekolah
        schoolId: sekolahGuru.id,

        sekolah: sekolahGuru.nama,
        kotaKab: sekolahGuru.kotaKab,
        kecamatan: sekolahGuru.kecamatan,

        status: 'aktif'
      }
    })

    console.log(
      `   ✅ ${guru.email} → ${sekolahGuru.nama}`
    )
  }

  // =====================================================
  // SELESAI
  // =====================================================

  console.log('')
  console.log('🎉 Seeder selesai!')
  console.log('')
  console.log('📋 Account login:')
  console.log('   Admin')
  console.log('   Email    : admin@dummy.com')
  console.log('   Password : Password123!')
  console.log('')
  console.log('   Pengajar')
  console.log('   Email    : pengajar@dummy.com')
  console.log('   Password : Password123!')
  console.log(`   Sekolah  : ${sekolahPengajar.nama}`)
  console.log('')
  console.log('   Guru')
  console.log('   Contoh   : asep.sukandar@dummy.com')
  console.log('   Password : Password123!')
  console.log('')
}

// =====================================================
// EXECUTE SEED
// =====================================================

main()
  .catch((error) => {
    console.error(
      '❌ Gagal memperbarui data dummy:',
      error
    )

    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })