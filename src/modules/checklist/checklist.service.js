// src/modules/checklist/checklist.service.js

const prisma = require('../../config/database')

// ================================================
// GET CHECKLIST ITEMS — Ambil semua template item
// ================================================
const getChecklistItems = async () => {
  const items = await prisma.checklistItem.findMany({
    where: { isActive: true },
    orderBy: [
      { aspek: 'asc' },
      { urutan: 'asc' }
    ]
  })
  return items
}

// ================================================
// CREATE CHECKLIST ITEM — Admin buat item baru
// ================================================
const createChecklistItem = async (data) => {
  const { aspek, deskripsi, urutan } = data

  const itemBaru = await prisma.checklistItem.create({
    data: { aspek, deskripsi, urutan }
  })

  return itemBaru
}

// ================================================
// UPDATE CHECKLIST ITEM — Admin update item
// ================================================
const updateChecklistItem = async (id, data) => {
  const { aspek, deskripsi, urutan, isActive } = data

  const itemAda = await prisma.checklistItem.findUnique({
    where: { id }
  })

  if (!itemAda) {
    throw new Error('Item checklist tidak ditemukan')
  }

  const itemUpdated = await prisma.checklistItem.update({
    where: { id },
    data: {
      ...(aspek && { aspek }),
      ...(deskripsi && { deskripsi }),
      ...(urutan && { urutan }),
      ...(isActive !== undefined && { isActive })
    }
  })

  return itemUpdated
}

// ================================================
// DELETE CHECKLIST ITEM — Admin hapus item
// ================================================
const deleteChecklistItem = async (id) => {
  const itemAda = await prisma.checklistItem.findUnique({
    where: { id }
  })

  if (!itemAda) {
    throw new Error('Item checklist tidak ditemukan')
  }

  await prisma.checklistItem.delete({ where: { id } })

  return { pesan: 'Item checklist berhasil dihapus' }
}

// ================================================
// GET TODAY CHECKLIST — Ambil checklist hari ini
// ================================================
const getTodayChecklist = async (userId) => {
  // Ambil tanggal hari ini (tanpa jam)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Ambil semua item aktif
  const allItems = await prisma.checklistItem.findMany({
    where: { isActive: true },
    orderBy: [{ aspek: 'asc' }, { urutan: 'asc' }]
  })

  // Ambil checklist guru hari ini
  const todayChecklist = await prisma.dailyChecklist.findMany({
    where: {
      userId,
      tanggal: {
        gte: today,
        lt: tomorrow
      }
    }
  })

  // Gabungkan item dengan status hari ini
  const result = allItems.map(item => {
    const checklist = todayChecklist.find(
      c => c.checklistItemId === item.id
    )
    return {
      ...item,
      isChecked: checklist?.isChecked || false,
      fotoBukti: checklist?.fotoBukti || null,
      checklistId: checklist?.id || null
    }
  })

  // Kelompokkan per aspek
  const grouped = result.reduce((acc, item) => {
    if (!acc[item.aspek]) acc[item.aspek] = []
    acc[item.aspek].push(item)
    return acc
  }, {})

  // Hitung statistik
  const totalItem = allItems.length
  const totalChecked = todayChecklist.filter(c => c.isChecked).length

  return {
    tanggal: today,
    statistik: {
      totalItem,
      totalChecked,
      persentase: totalItem > 0
        ? Math.round((totalChecked / totalItem) * 100)
        : 0
    },
    checklist: grouped
  }
}

// ================================================
// SUBMIT CHECKLIST — Guru submit checklist hari ini
// ================================================
const submitChecklist = async (userId, data) => {
  const { items } = data
  // items = [{ checklistItemId, isChecked, fotoBukti }]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Proses setiap item
  const hasil = await Promise.all(
    items.map(async (item) => {
      // Pastikan item ada & aktif
      const itemAda = await prisma.checklistItem.findUnique({
        where: { id: item.checklistItemId }
      })

      if (!itemAda || !itemAda.isActive) {
        throw new Error(`Item checklist tidak ditemukan`)
      }

      // Upsert — update kalau sudah ada, buat baru kalau belum
      const checklist = await prisma.dailyChecklist.upsert({
        where: {
          userId_checklistItemId_tanggal: {
            userId,
            checklistItemId: item.checklistItemId,
            tanggal: today
          }
        },
        update: {
          isChecked: item.isChecked,
          fotoBukti: item.fotoBukti || null
        },
        create: {
          userId,
          checklistItemId: item.checklistItemId,
          tanggal: today,
          isChecked: item.isChecked,
          fotoBukti: item.fotoBukti || null
        }
      })

      return checklist
    })
  )

  return {
    pesan: 'Checklist berhasil disimpan',
    totalDisimpan: hasil.length
  }
}

// ================================================
// GET HISTORY — Riwayat checklist guru
// ================================================
const getChecklistHistory = async (userId, days = 7) => {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const history = await prisma.dailyChecklist.findMany({
    where: {
      userId,
      tanggal: { gte: startDate }
    },
    include: {
      checklistItem: {
        select: {
          aspek: true,
          deskripsi: true
        }
      }
    },
    orderBy: { tanggal: 'desc' }
  })

  // Kelompokkan per tanggal
  const grouped = history.reduce((acc, item) => {
    const tanggal = item.tanggal.toISOString().split('T')[0]
    if (!acc[tanggal]) acc[tanggal] = []
    acc[tanggal].push(item)
    return acc
  }, {})

  return grouped
}

// ================================================
// GET REPORT — Admin lihat rekap konsistensi guru
// ================================================
const getChecklistReport = async (days = 7) => {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // Ambil semua guru
  const allGuru = await prisma.user.findMany({
    where: { role: 'guru' },
    select: { id: true, nama: true, email: true }
  })

  // Ambil semua checklist dalam rentang waktu
  const allChecklists = await prisma.dailyChecklist.findMany({
    where: {
      tanggal: { gte: startDate },
      isChecked: true
    },
    select: {
      userId: true,
      tanggal: true,
      isChecked: true
    }
  })

  // Hitung konsistensi per guru
  const report = allGuru.map(guru => {
    const guruChecklists = allChecklists.filter(
      c => c.userId === guru.id
    )

    // Hitung berapa hari guru mengisi checklist
    const hariAktif = new Set(
      guruChecklists.map(c => c.tanggal.toISOString().split('T')[0])
    ).size

    return {
      ...guru,
      hariAktif,
      totalHari: days,
      persentaseKonsistensi: Math.round((hariAktif / days) * 100)
    }
  })

  // Urutkan dari yang paling konsisten
  report.sort((a, b) => b.persentaseKonsistensi - a.persentaseKonsistensi)

  return {
    periodeHari: days,
    totalGuru: allGuru.length,
    report
  }
}

// ================================================
// GET FOTO BUKTI — Admin lihat foto bukti per guru
// ================================================
const getFotoBukti = async (filters) => {
  const { userId, tanggal, days = 7 } = filters

  const startDate = tanggal
    ? new Date(tanggal)
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  startDate.setHours(0, 0, 0, 0)

  const where = {
    tanggal: { gte: startDate },
    fotoBukti: { not: null }
  }

  if (userId) where.userId = userId

  const fotoBukti = await prisma.dailyChecklist.findMany({
    where,
    select: {
      id: true,
      tanggal: true,
      isChecked: true,
      fotoBukti: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          nama: true,
          email: true,
          sekolah: true
        }
      },
      checklistItem: {
        select: {
          aspek: true,
          deskripsi: true
        }
      }
    },
    orderBy: { tanggal: 'desc' }
  })

  return fotoBukti
}

module.exports = {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getTodayChecklist,
  submitChecklist,
  getChecklistHistory,
  getChecklistReport,
  getFotoBukti
}