# 📚 LMS Pancawaluya - Back-End API

RESTful API untuk **LMS Pancawaluya**, portal pembelajaran guru SMA. Aplikasi memakai Node.js, Express, Prisma ORM, dan PostgreSQL Supabase; juga menyediakan JWT, OTP email, serta penyimpanan gambar di Supabase Storage.

---

## 🛠️ Tech Stack & Library

- **Node.js** — runtime aplikasi (v18+ disarankan).
- **Express 5** — server HTTP dan router API.
- **Prisma ORM / Prisma Client** — skema, migrasi, dan akses database.
- **PostgreSQL / Supabase** — database utama; Supabase juga menangani Storage.
- **jsonwebtoken** dan **bcryptjs** — autentikasi JWT dan hashing password.
- **Resend** — pengiriman email OTP registrasi serta reset password.
- **Multer** dan **exifr** — unggahan gambar dan pembacaan metadata foto.
- **Helmet** dan **CORS** — keamanan header dan pengaturan akses lintas origin.
- **Nodemon** — hot reload untuk pengembangan.

---

## 🚀 Panduan Instalasi & Jalankan Server

### 1. Prasyarat Sistem

- Node.js v18+.
- Database PostgreSQL lokal atau proyek Supabase.

### 2. Langkah Instalasi

1. Kloning repositori.

   ```bash
   git clone https://github.com/lms-pancawaluya/backend.git
   cd backend
   ```

2. Instal dependensi.

   ```bash
   npm install
   ```

3. Buat `.env` dari contoh yang tersedia.

   ```bash
   Copy-Item .env.example .env
   ```

   ```env
   # Server
   PORT=3000
   NODE_ENV=development

   # Frontend URL (untuk CORS)
   FRONTEND_URL=*

   # Database
   DATABASE_URL="postgresql://postgres.CONNECTIONSTRING:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

   # Connect to Postgres via the shared session-mode pooler (used for migrations)
   DIRECT_URL="postgresql://postgres.CONNECTIONSTRING:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

   # Supabase Storage
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key

   # JWT
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRES_IN=7d

   # Email
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_gmail_app_password
   ```

   `src/config/mailer.js` juga menggunakan Resend, sehingga tambahkan variabel berikut. `EMAIL_USER` dan `EMAIL_PASS` masih berada di `.env.example`, tetapi tidak digunakan oleh mailer saat ini.

   ```env
   RESEND_API_KEY=re_your_resend_api_key
   ```

4. Jalankan migrasi Prisma.

   ```bash
   npx prisma migrate dev
   ```

5. Jalankan server pengembangan.

   ```bash
   npm run dev
   ```

   Server berjalan pada `PORT` atau port bawaan `3000`.

---

## 🔒 Otentikasi & Otorisasi Role

Role yang tersedia pada database adalah `admin` dan `guru`. Admin mengelola pengguna, modul, konten, evaluasi, checklist, dan monitoring. Guru mempelajari modul, mengerjakan kuis/evaluasi, mengisi checklist, dan mengelola profil sendiri.

Setiap endpoint yang tidak berlabel **Publik** membutuhkan JWT yang valid.

```http
Authorization: Bearer <JWT_TOKEN>
```

`authMiddleware` memverifikasi token lalu memuat `id`, `nama`, `email`, dan `role` pengguna dari database. Label **Terautentikasi** di bawah berarti route hanya memasang middleware ini tanpa pembatasan role tambahan.

---

## 📖 Ringkasan Dokumentasi API Endpoint

Parameter `:id`, `:moduleId`, `:contentId`, `:questionId`, dan `:userId` adalah parameter path.

### Dasar

- `GET /` `(Publik)`
  *Deskripsi:* Memeriksa status server API.

### Autentikasi

- `POST /api/auth/register` `(Publik)`
  *Deskripsi:* Mendaftarkan akun dan mengirim OTP verifikasi.
- `POST /api/auth/verify-otp` `(Publik)`
  *Deskripsi:* Memverifikasi OTP pendaftaran.
- `POST /api/auth/resend-otp` `(Publik)`
  *Deskripsi:* Mengirim ulang OTP pendaftaran.
- `POST /api/auth/login` `(Publik)`
  *Deskripsi:* Login dengan `identifier` (email/NIP; field `email` juga didukung) dan password.
- `POST /api/auth/forgot-password` `(Publik)`
  *Deskripsi:* Mengirim OTP reset password melalui email.
- `POST /api/auth/verify-reset-otp` `(Publik)`
  *Deskripsi:* Memverifikasi OTP reset password.
- `POST /api/auth/reset-password` `(Publik)`
  *Deskripsi:* Mengganti password setelah verifikasi reset.
- `GET /api/auth/me` `(Terautentikasi)`
  *Deskripsi:* Mengambil data user dari token yang telah diverifikasi.
- `PUT /api/auth/admin/reset-password/:userId` `(Terautentikasi)`
  *Deskripsi:* Mereset password user berdasarkan ID. Route ini tidak memasang pembatasan role admin.

### Pengguna

- `GET /api/users/` `(Admin)`
  *Deskripsi:* Mengambil seluruh pengguna.
- `GET /api/users/:id` `(Terautentikasi; guru hanya dirinya sendiri)`
  *Deskripsi:* Mengambil detail pengguna.
- `PUT /api/users/:id` `(Terautentikasi; guru hanya dirinya sendiri)`
  *Deskripsi:* Memperbarui pengguna; hanya admin dapat mengubah role.
- `DELETE /api/users/:id` `(Admin)`
  *Deskripsi:* Menghapus pengguna selain akun admin yang sedang dipakai.
- `GET /api/users/profile/me` `(Terautentikasi)`
  *Deskripsi:* Route terdaftar untuk mengambil profil sendiri.
- `PUT /api/users/profile/me` `(Terautentikasi)`
  *Deskripsi:* Route terdaftar untuk memperbarui profil sendiri.
- `PUT /api/users/profile/me/password` `(Terautentikasi)`
  *Deskripsi:* Mengganti password sendiri.
- `PUT /api/users/:id/reset-password` `(Admin)`
  *Deskripsi:* Mereset password pengguna.

> **Catatan:** `GET /api/users/:id` dan `PUT /api/users/:id` didefinisikan sebelum `/profile/me`. Karena urutan Express, `GET` dan `PUT /api/users/profile/me` tertangkap sebagai `:id = profile`. Route `/profile/me/password` tetap dapat dicapai.

### Modul Pembelajaran

- `GET /api/modules/` `(Terautentikasi)`
  *Deskripsi:* Mengambil semua modul.
- `GET /api/modules/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil detail modul.
- `POST /api/modules/` `(Admin)`
  *Deskripsi:* Membuat modul pembelajaran.
- `PUT /api/modules/:id` `(Admin)`
  *Deskripsi:* Memperbarui modul.
- `DELETE /api/modules/:id` `(Admin)`
  *Deskripsi:* Menghapus modul.

### Konten Modul

Router konten tersedia sebagai route nested yang fungsional dan juga dipasang langsung pada `/api/contents`.

- `GET /api/modules/:moduleId/contents/` `(Terautentikasi)`
  *Deskripsi:* Mengambil seluruh konten pada modul.
- `POST /api/modules/:moduleId/contents/` `(Admin)`
  *Deskripsi:* Menambahkan konten teks atau video ke modul.
- `PUT /api/modules/:moduleId/contents/:id` `(Admin)`
  *Deskripsi:* Memperbarui konten.
- `DELETE /api/modules/:moduleId/contents/:id` `(Admin)`
  *Deskripsi:* Menghapus konten.
- `GET /api/contents/` `(Terautentikasi)`
  *Deskripsi:* Route langsung; controller mengharapkan parameter `moduleId` yang tidak tersedia dari mount ini.
- `POST /api/contents/` `(Admin)`
  *Deskripsi:* Route langsung; controller mengharapkan parameter `moduleId`.
- `PUT /api/contents/:id` `(Admin)`
  *Deskripsi:* Memperbarui konten berdasarkan ID.
- `DELETE /api/contents/:id` `(Admin)`
  *Deskripsi:* Menghapus konten berdasarkan ID.

### Evaluasi Modul

Router evaluasi terdaftar baik di bawah modul maupun langsung pada `/api/evaluations`.

- `GET /api/modules/:moduleId/evaluations/` `(Terautentikasi)`
  *Deskripsi:* Mengambil evaluasi pada modul.
- `GET /api/modules/:moduleId/evaluations/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil evaluasi dan soal.
- `POST /api/modules/:moduleId/evaluations/` `(Admin)`
  *Deskripsi:* Membuat evaluasi pada modul.
- `POST /api/modules/:moduleId/evaluations/:id/questions` `(Admin)`
  *Deskripsi:* Menambahkan soal pilihan ganda.
- `PUT /api/modules/:moduleId/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Memperbarui soal evaluasi.
- `DELETE /api/modules/:moduleId/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Menghapus soal evaluasi.
- `POST /api/modules/:moduleId/evaluations/:id/submit` `(Guru)`
  *Deskripsi:* Mengirim jawaban evaluasi untuk dinilai.
- `GET /api/modules/:moduleId/evaluations/:id/answers` `(Admin)`
  *Deskripsi:* Mengambil jawaban seluruh user pada evaluasi.
- `GET /api/modules/:moduleId/evaluations/:id/my-answers` `(Terautentikasi)`
  *Deskripsi:* Mengambil jawaban user saat ini.
- `GET /api/evaluations/` `(Terautentikasi)`
  *Deskripsi:* Route langsung; controller mengharapkan `moduleId` parameter.
- `GET /api/evaluations/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil evaluasi dan soal.
- `POST /api/evaluations/` `(Admin)`
  *Deskripsi:* Route langsung; controller mengharapkan `moduleId` parameter.
- `POST /api/evaluations/:id/questions` `(Admin)`
  *Deskripsi:* Menambahkan soal evaluasi.
- `PUT /api/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Memperbarui soal evaluasi.
- `DELETE /api/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Menghapus soal evaluasi.
- `POST /api/evaluations/:id/submit` `(Guru)`
  *Deskripsi:* Mengirim jawaban evaluasi.
- `GET /api/evaluations/:id/answers` `(Admin)`
  *Deskripsi:* Mengambil semua jawaban evaluasi.
- `GET /api/evaluations/:id/my-answers` `(Terautentikasi)`
  *Deskripsi:* Mengambil jawaban user saat ini.

### Progress Belajar

- `GET /api/progress/` `(Admin atau Guru)`
  *Deskripsi:* Mengambil semua progress milik user yang sedang login.
- `GET /api/progress/summary` `(Terautentikasi)`
  *Deskripsi:* Mengambil ringkasan progress seluruh modul milik user saat ini.
- `POST /api/progress/:moduleId/start` `(Admin atau Guru)`
  *Deskripsi:* Memulai modul untuk user saat ini.
- `POST /api/progress/:moduleId/complete` `(Admin atau Guru)`
  *Deskripsi:* Menandai modul selesai untuk user saat ini.
- `GET /api/progress/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengambil progress pada satu modul.

### Checklist Harian

- `GET /api/checklist/items` `(Terautentikasi)`
  *Deskripsi:* Mengambil template item checklist.
- `POST /api/checklist/items` `(Admin)`
  *Deskripsi:* Membuat template item.
- `PUT /api/checklist/items/:id` `(Admin)`
  *Deskripsi:* Memperbarui template item.
- `DELETE /api/checklist/items/:id` `(Admin)`
  *Deskripsi:* Menghapus template item.
- `GET /api/checklist/today` `(Admin atau Guru)`
  *Deskripsi:* Mengambil checklist hari ini bagi user saat ini.
- `POST /api/checklist/today` `(Admin atau Guru)`
  *Deskripsi:* Menyimpan checklist hari ini.
- `GET /api/checklist/history` `(Admin atau Guru)`
  *Deskripsi:* Mengambil riwayat checklist; mendukung query `days`.
- `GET /api/checklist/report` `(Admin)`
  *Deskripsi:* Mengambil rekap konsistensi guru; mendukung query `days`.
- `GET /api/checklist/foto-bukti` `(Admin)`
  *Deskripsi:* Mengambil foto bukti; mendukung query `userId`, `tanggal`, dan `days`.

### Mini Kuis

- `GET /api/mini-quizzes/content/:contentId` `(Terautentikasi)`
  *Deskripsi:* Mengambil mini kuis pada konten.
- `POST /api/mini-quizzes/content/:contentId` `(Admin)`
  *Deskripsi:* Membuat mini kuis pada konten.
- `GET /api/mini-quizzes/content/:contentId/check-lock` `(Terautentikasi)`
  *Deskripsi:* Memeriksa status penguncian konten bagi user saat ini.
- `PUT /api/mini-quizzes/questions/:id` `(Admin)`
  *Deskripsi:* Memperbarui soal mini kuis.
- `DELETE /api/mini-quizzes/questions/:id` `(Admin)`
  *Deskripsi:* Menghapus soal mini kuis.
- `PUT /api/mini-quizzes/:id` `(Admin)`
  *Deskripsi:* Memperbarui header mini kuis.
- `DELETE /api/mini-quizzes/:id` `(Admin)`
  *Deskripsi:* Menghapus mini kuis dan seluruh soalnya.
- `POST /api/mini-quizzes/:id/questions` `(Admin)`
  *Deskripsi:* Menambahkan soal mini kuis.
- `GET /api/mini-quizzes/:id/my-attempts` `(Guru)`
  *Deskripsi:* Mengambil riwayat percobaan user saat ini.
- `POST /api/mini-quizzes/:id/attempt` `(Guru)`
  *Deskripsi:* Mengirim jawaban dan mencatat percobaan mini kuis.

Router mini kuis yang sama juga dipasang pada setiap router konten. Seluruh sepuluh endpoint di atas **juga terdaftar** pada kedua prefiks berikut, dengan metode, parameter sufiks, akses, dan perilaku yang sama:

```text
/api/contents/:contentId/mini-quiz
/api/modules/:moduleId/contents/:contentId/mini-quiz
```

Sebagai contoh, endpoint attempt yang terdaftar adalah:

- `POST /api/contents/:contentId/mini-quiz/:id/attempt` `(Guru)`
  *Deskripsi:* Mengirim jawaban mini kuis melalui mount konten langsung.
- `POST /api/modules/:moduleId/contents/:contentId/mini-quiz/:id/attempt` `(Guru)`
  *Deskripsi:* Mengirim jawaban mini kuis melalui mount konten dalam modul.

Untuk endpoint berbasis konten pada kedua prefiks tersebut, sufiks router tetap `/content/:contentId`, `/content/:contentId/check-lock`, dan `POST /content/:contentId`.

### Umpan Balik

- `POST /api/feedbacks/module/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengirim saran dan kritik untuk modul; route tidak membatasi role ke guru.
- `GET /api/feedbacks/` `(Admin)`
  *Deskripsi:* Mengambil seluruh saran dan kritik.

### Unggah Berkas

Kedua route menerima `multipart/form-data` dengan field file bernama `foto`, hanya untuk JPEG, PNG, atau WebP, maksimal 5 MB.

- `POST /api/upload/foto-profil` `(Terautentikasi)`
  *Deskripsi:* Mengunggah foto profil ke Storage dan memperbarui `fotoProfil` user.
- `POST /api/upload/foto-bukti` `(Terautentikasi)`
  *Deskripsi:* Mengunggah foto bukti checklist dan memvalidasi metadata foto.

### Monitoring Admin

- `GET /api/admin/users/:userId/progress` `(Admin)`
  *Deskripsi:* Mengambil progress modul seorang user.
- `GET /api/admin/users/:userId/evaluations` `(Admin)`
  *Deskripsi:* Mengambil data evaluasi seorang user.

---


## 📝 Lisensi

Aplikasi ini dikembangkan untuk kebutuhan platform LMS Pancawaluya.
