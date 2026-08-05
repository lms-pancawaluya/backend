// src/config/database.js

const { PrismaClient } = require('@prisma/client')

// Buat satu instance PrismaClient
// Instance ini akan dipakai oleh seluruh aplikasi
const prisma = new PrismaClient()

module.exports = prisma