const prisma = require('../../config/database')

// Master List Fitur/Menu App untuk Navigasi Cepat
const FEATURES_LIST = [
  { judul: 'Dashboard Utama', tipe: 'FITUR', linkUrl: '/dashboard' },
  { judul: 'Daftar Modul Pembelajaran', tipe: 'FITUR', linkUrl: '/modules' },
  { judul: 'Upload & Progress RTL (Rencana Tindak Lanjut)', tipe: 'FITUR', linkUrl: '/rtl' },
  { judul: 'Helpdesk & Bantuan', tipe: 'FITUR', linkUrl: '/helpdesk' },
  { judul: 'Pengaturan Profil Saya', tipe: 'FITUR', linkUrl: '/profile' }
]

const globalSearch = async (query, user) => {
  if (!query || query.trim() === '') {
    return { features: [], modules: [], contents: [], tickets: [] }
  }

  const cleanQuery = query.trim()

  // 1. Cari di Fitur/Menu Statis
  const matchedFeatures = FEATURES_LIST.filter((feature) =>
    feature.judul.toLowerCase().includes(cleanQuery.toLowerCase())
  )

  // 2. Query Paralel ke Database
  const [modules, contents, tickets] = await Promise.all([
    // Cari Modul (Judul & Deskripsi)
    prisma.module.findMany({
      where: {
        OR: [
          { judul: { contains: cleanQuery, mode: 'insensitive' } },
          { deskripsi: { contains: cleanQuery, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        judul: true,
        deskripsi: true
      },
      take: 5
    }),

    // Cari Materi / Video
    prisma.content.findMany({
      where: {
        OR: [
          { judul: { contains: cleanQuery, mode: 'insensitive' } },
          { konten: { contains: cleanQuery, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        judul: true,
        tipe: true,
        moduleId: true
      },
      take: 5
    }),

    // Cari Tiket Helpdesk (Guru hanya bisa cari tiket miliknya sendiri)
    prisma.ticket.findMany({
      where: {
        OR: [
          { ticketNumber: { contains: cleanQuery, mode: 'insensitive' } },
          { subject: { contains: cleanQuery, mode: 'insensitive' } }
        ],
        ...(user.role === 'guru' ? { userId: user.id } : {})
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true
      },
      take: 5
    })
  ])

  // Formatting response agar aman (linkUrl materi diarahkan ke modulnya)
  return {
    features: matchedFeatures,
    modules: modules.map((m) => ({
      id: m.id,
      judul: m.judul,
      deskripsi: m.deskripsi,
      tipe: 'MODUL',
      linkUrl: `/modules/${m.id}`
    })),
    contents: contents.map((c) => ({
      id: c.id,
      judul: c.judul,
      jenisKonten: c.tipe,
      tipe: 'MATERI',
      // PENTING: Diarahkan ke halaman detail modul (BUKAN direct ke materinya)
      // agar validasi kunci/buka materi tetap di-handle oleh logika modul
      linkUrl: `/modules/${c.moduleId}`
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      judul: `#${t.ticketNumber} - ${t.subject}`,
      status: t.status,
      tipe: 'HELPDESK',
      linkUrl: `/helpdesk/tickets/${t.id}`
    }))
  }
}

module.exports = { globalSearch }