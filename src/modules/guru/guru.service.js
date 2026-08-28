const prisma = require('../../config/database')

const findGuruByNip = async (nip) => {
  return await prisma.masterGuru.findUnique({
    where: { 
      nip: String(nip).trim() 
    }
  })
}

const searchSekolahByName = async (keyword, limit = 10) => {
  if (!keyword) return []

  return await prisma.masterSekolah.findMany({
    where: {
      nama: {
        contains: keyword,
        mode: 'insensitive'
      }
    },
    take: limit,
    select: {
      id: true,
      npsn: true,
      nama: true,
      kotaKab: true,
      kecamatan: true
    }
  })
}

module.exports = {
  findGuruByNip,
  searchSekolahByName
}