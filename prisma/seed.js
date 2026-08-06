// prisma/seed.js

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Memulai proses seeding data...')

  // Hash password dulu sebelum disimpan
  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. Seed Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pancawaluya.sch.id' },
    update: {},
    create: {
      nama: 'Admin LMS',
      email: 'admin@pancawaluya.sch.id',
      password: hashedPassword, // ← pakai hash!
      role: 'admin',
    },
  })

  // 2. Seed Guru
  const guru = await prisma.user.upsert({
    where: { email: 'guru@sma.sch.id' },
    update: {},
    create: {
      nama: 'Budi Santoso, S.Pd.',
      email: 'guru@sma.sch.id',
      password: hashedPassword, // ← pakai hash!
      role: 'guru',
    },
  })

  // 3. Seed Modul Cageur
  const modulCageur = await prisma.module.upsert({
    where: { id: 'modul-cageur-001' },
    update: {},
    create: {
      id: 'modul-cageur-001',
      judul: 'Modul 1: Cageur - Sehat Fisik & Mental',
      deskripsi: 'Memahami pentingnya kesehatan fisik dan mental bagi pendidik dan siswa dalam menerapkan nilai Pancawaluya.',
      aspekPancawaluya: 'cageur',
      urutan: 1,
      contents: {
        create: [
          {
            judul: 'Pengantar Cageur',
            tipe: 'teks',
            konten: 'Konsep Cageur mencakup keseimbangan kesehatan jasmani dan rohani dalam kegiatan mengajar sehari-hari.',
            urutan: 1,
          },
          {
            judul: 'Video Panduan Kesehatan Mental Guru',
            tipe: 'video',
            konten: 'https://www.youtube.com/watch?v=example',
            urutan: 2,
          },
        ],
      },
      evaluations: {
        create: {
          judul: 'Evaluasi Modul Cageur',
          questions: {
            create: [
              {
                pertanyaan: 'Apa yang dimaksud dengan konsep Cageur dalam Pancawaluya?',
                tipe: 'pilihan_ganda',
                options: {
                  create: [
                    { teksOpsi: 'Sehat fisik dan mental', isCorrect: true },
                    { teksOpsi: 'Disiplin dan integritas', isCorrect: false },
                    { teksOpsi: 'Kepemimpinan yang responsif', isCorrect: false },
                    { teksOpsi: 'Percaya diri dan kolaborasi', isCorrect: false },
                  ],
                },
              },
              {
                pertanyaan: 'Bagaimana cara Anda menerapkan prinsip Cageur di kelas?',
                tipe: 'esai',
              },
            ],
          },
        },
      },
    },
  })

  console.log('Seeding selesai!')
  console.log('Admin:', admin.email)
  console.log('Guru:', guru.email)
  console.log('Password untuk semua akun: password123')
}

main()
  .catch((e) => {
    console.error('Error saat seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })