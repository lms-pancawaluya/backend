const prisma = require('../../config/database')

// Upload atau Update RTL
const uploadRtl = async (userId, data) => {
  const { moduleId, filePdfUrl, catatanGuru } = data

  if (!moduleId || !filePdfUrl) {
    throw new Error('Module ID dan URL File PDF wajib diisi')
  }

  const rtl = await prisma.rtlSubmission.upsert({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    update: {
      filePdfUrl,
      catatanGuru: catatanGuru || null,
      status: 'pending',
      catatanTrainer: null,
      reviewedById: null,
      reviewedAt: null
    },
    create: {
      userId,
      moduleId,
      filePdfUrl,
      catatanGuru: catatanGuru || null,
      status: 'pending'
    }
  })

  return rtl
}

// Get RTL milik user per Modul
const getRtlByModule = async (userId, moduleId) => {
  const rtl = await prisma.rtlSubmission.findUnique({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    include: {
      reviewedBy: {
        select: { nama: true, gelar: true }
      }
    }
  })

  return rtl
}

// Admin / Pengajar Get Semua Submissions
const getAllRtlSubmissions = async (filters) => {
  const { status, moduleId } = filters
  const whereClause = {}

  if (status) whereClause.status = status
  if (moduleId) whereClause.moduleId = moduleId

  const rtlList = await prisma.rtlSubmission.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, nama: true, sekolah: true, kota: true, daerah: true } },
      module: { select: { id: true, judul: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return rtlList
}

// Review RTL oleh Pengajar / Admin
const reviewRtl = async (rtlId, trainerId, data) => {
  const { status, catatanTrainer } = data

  if (!['disetujui', 'ditolak'].includes(status)) {
    throw new Error('Status review harus disetujui atau ditolak')
  }

  const updatedRtl = await prisma.rtlSubmission.update({
    where: { id: rtlId },
    data: {
      status,
      catatanTrainer: catatanTrainer || null,
      reviewedById: trainerId,
      reviewedAt: new Date()
    }
  })

  return updatedRtl
}

module.exports = {
  uploadRtl,
  getRtlByModule,
  getAllRtlSubmissions,
  reviewRtl
}