// src/index.js

const app = require('./config/app')
const authRoute = require('./modules/auth/auth.route')

const PORT = process.env.PORT || 3000

// ===== DAFTARKAN SEMUA ROUTE =====
// Semua route auth akan diawali dengan /api/auth
app.use('/api/auth', authRoute)

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server LMS Pancawaluya berjalan di http://localhost:${PORT}`)
  console.log(`API tersedia di http://localhost:${PORT}/api`)
})