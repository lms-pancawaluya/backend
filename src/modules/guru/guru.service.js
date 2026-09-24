// src/modules/guru/guru.service.js

const prisma = require('../../config/database')

const findGuruByNip = async (nip) => {
  if (!nip) return null

  return await prisma.masterGuru.findUnique({
    where: { 
      nip: String(nip).trim() 
    }
  })
}

const searchSekolahByName = async (keyword, limit = 10) => {
  const cleanKeyword = String(keyword || '').trim()
  if (!cleanKeyword) return []

  return await prisma.masterSekolah.findMany({
    where: {
      OR: [
        {
          nama: {
            contains: cleanKeyword,
            mode: 'insensitive'
          }
        },
        {
          npsn: {
            contains: cleanKeyword,
            mode: 'insensitive'
          }
        }
      ]
    },
    take: limit,
    select: {
      id: true,
      npsn: true,
      nama: true,
      kotaKab: true,
      kecamatan: true
    },
    orderBy: {
      nama: 'asc'
    }
  })
}

module.exports = {
  findGuruByNip,
  searchSekolahByName
}