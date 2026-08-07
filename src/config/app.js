// src/config/app.js

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

// Buat aplikasi Express
const app = express()

// ===== MIDDLEWARE =====

// 1. Helmet — keamanan dasar
app.use(helmet())

// 2. CORS — izinkan frontend akses API ini
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://10.10.20.212:3001',
  credentials: true
}))

// 3. JSON Parser — agar server bisa baca data JSON dari request
app.use(express.json())

// 4. URL Encoded Parser — agar server bisa baca data dari form HTML
app.use(express.urlencoded({ extended: true }))

// ===== ROUTE DASAR =====
// Untuk cek apakah server berjalan
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    pesan: 'Server LMS Pancawaluya berjalan!',
    versi: '1.0.0'
  })
})

// Ekspor app agar bisa dipakai di file lain
module.exports = app