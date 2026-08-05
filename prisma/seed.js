const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Memulai proses seeding data...');

  // 1. Seed Data Users (1 Admin & 1 Guru)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pancawaluya.sch.id' },
    update: {},
    create: {
      nama: 'Admin LMS',
      email: 'admin@pancawaluya.sch.id',
      password: 'password123', // Nanti di backend riil di-hash dengan bcrypt
      role: 'admin',
    },
  });

  const guru = await prisma.user.upsert({
    where: { email: 'guru@sma.sch.id' },
    update: {},
    create: {
      nama: 'Budi Santoso, S.Pd.',
      email: 'guru@sma.sch.id',
      password: 'password123',
      role: 'guru',
    },
  });

  // 2. Seed Data Modul Pancawaluya (5 Aspek)
  const modulCageur = await prisma.module.create({
    data: {
      judul: 'Modul 1: Cageur (Sehat Fisik & Mental)',
      deskripsi: 'Memahami pentingnya kesehatan fisik dan mental bagi pendidik dan siswa.',
      aspekPancawaluya: 'cageur',
      urutan: 1,
      contents: {
        create: [
          {
            judul: 'Pengantar Cageur',
            tipe: 'teks',
            konten: 'Konsep Cageur mencakup keseimbangan kesehatan jasmani dan rohani dalam kegiatan mengajar.',
            urutan: 1,
          },
          {
            judul: 'Video Panduan Kesehatan Mental Guru',
            tipe: 'video',
            konten: 'https://www.youtube.com/watch?dq_example',
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
  });

  console.log('Seeding selesai!');
}

main()
  .catch((e) => {
    console.error('Error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });