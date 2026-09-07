// src/config/app.js

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

// Buat aplikasi Express
const app = express()

// ===== MIDDLEWARE =====

// 1. Helmet — keamanan dasar (nonaktifkan crossOriginResourcePolicy agar tidak memblokir media/ngrok)
app.use(helmet({
  crossOriginResourcePolicy: false
}))

// 2. CORS — izinkan frontend akses API ini
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://10.10.20.212:3001',
  process.env.FRONTEND_URL
].filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    // Izinkan request tanpa origin (Postman/Thunder Client) atau jika origin terdaftar
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'ngrok-skip-browser-warning' // <--- DIIZINKAN UNTUK NGROK
  ]
}

// Pasang middleware CORS (Otomatis menangani preflight OPTIONS tanpa perlu app.options('*'))
app.use(cors(corsOptions))

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