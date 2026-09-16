# 📚 LMS Pancawaluya - Back-End API

RESTful API untuk **LMS Pancawaluya**, portal pembelajaran guru SMA. Aplikasi menggunakan Node.js, Express, Prisma ORM, PostgreSQL Supabase, autentikasi JWT, email OTP, dan Supabase Storage.

---

## 🛠️ Tech Stack & Library

- **Node.js** — runtime aplikasi; v18+ disarankan.
- **Express 5** — server HTTP dan router API.
- **Prisma ORM / Prisma Client** — skema, migrasi, seed, dan akses database.
- **PostgreSQL / Supabase** — database utama serta layanan penyimpanan berkas.
- **jsonwebtoken** dan **bcryptjs** — token autentikasi dan hashing password.
- **Resend** — pengiriman OTP registrasi dan reset password.
- **Multer** — unggahan gambar profil serta dokumen RTL PDF.
- **Helmet** dan **CORS** — keamanan header dan akses lintas origin.
- **Nodemon** — hot reload saat pengembangan.

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

3. Salin `.env.example` ke `.env` lalu isi konfigurasinya.

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

   Konfigurasi mailer juga membaca `RESEND_API_KEY`; tambahkan variabel berikut agar pengiriman OTP berfungsi. `EMAIL_USER` dan `EMAIL_PASS` masih tersedia di `.env.example`, tetapi tidak dipakai oleh mailer saat ini.

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

---

## 🔒 Otentikasi & Otorisasi Role

Role yang tersedia adalah `admin`, `guru`, dan `pengajar`.

- **Admin** mengelola pengguna, modul, konten, evaluasi, monitoring, submission RTL, dan tiket bantuan.
- **Guru** mempelajari modul, mengerjakan kuis/evaluasi, mengirim komentar, mengunggah RTL, dan membuat tiket bantuan.
- **Pengajar** meninjau RTL, memantau data pengguna, menangani tiket bantuan, serta mengakses riwayat dan pengerjaan mini kuis bersama guru.

Setiap endpoint yang tidak berlabel **Publik** membutuhkan JWT valid.

```http
Authorization: Bearer <JWT_TOKEN>
```

Label **Terautentikasi** berarti router hanya memasang `authMiddleware` dan tidak memiliki pembatasan role tambahan.

---

## 📖 Ringkasan Dokumentasi API Endpoint

Parameter seperti `:id`, `:moduleId`, `:contentId`, `:questionId`, `:userId`, `:rtlId`, dan `:ticketId` adalah parameter path.

### Autentikasi — `/api/auth`

- `POST /api/auth/register` `(Publik)`
  *Deskripsi:* Mendaftarkan akun dan mengirim OTP verifikasi.
- `POST /api/auth/verify-otp` `(Publik)`
  *Deskripsi:* Memverifikasi OTP pendaftaran.
- `POST /api/auth/resend-otp` `(Publik)`
  *Deskripsi:* Mengirim ulang OTP pendaftaran.
- `POST /api/auth/login` `(Publik)`
  *Deskripsi:* Login memakai `identifier` (email atau NIP; field `email` juga didukung) dan password.
- `POST /api/auth/forgot-password` `(Publik)`
  *Deskripsi:* Mengirim OTP reset password melalui email.
- `POST /api/auth/verify-reset-otp` `(Publik)`
  *Deskripsi:* Memverifikasi OTP reset password.
- `POST /api/auth/reset-password` `(Publik)`
  *Deskripsi:* Mengganti password setelah verifikasi reset.
- `GET /api/auth/me` `(Terautentikasi)`
  *Deskripsi:* Mengambil data pengguna dari token terverifikasi.
- `PUT /api/auth/admin/reset-password/:userId` `(Terautentikasi)`
  *Deskripsi:* Mereset password pengguna berdasarkan ID; route ini tidak memasang pembatasan role admin.

### Pengguna — `/api/users`

- `GET /api/users/` `(Admin atau Pengajar)`
  *Deskripsi:* Mengambil seluruh pengguna; mendukung query `sekolah`, `kotaKab`, `kecamatan`, `status`, `search`, dan `role`.
- `GET /api/users/profile/me` `(Terautentikasi)`
  *Deskripsi:* Mengambil profil pengguna saat ini.
- `PUT /api/users/profile/me` `(Terautentikasi)`
  *Deskripsi:* Memperbarui profil sendiri. Role `guru` tidak dapat mengubah `sekolah`, `kotaKab`, dan `kecamatan`.
- `PUT /api/users/profile/me/password` `(Terautentikasi)`
  *Deskripsi:* Mengganti password pengguna saat ini.
- `GET /api/users/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil detail pengguna; admin dan pengajar dapat melihat semua pengguna, guru hanya dapat melihat dirinya sendiri.
- `PUT /api/users/:id` `(Admin atau Pengajar)`
  *Deskripsi:* Memperbarui data pengguna. Pengajar hanya dapat mengubah data guru, sedangkan perubahan `role` hanya dapat dilakukan admin.
- `DELETE /api/users/:id` `(Admin)`
  *Deskripsi:* Menghapus pengguna selain akun admin yang sedang dipakai.
- `PUT /api/users/:id/reset-password` `(Admin)`
  *Deskripsi:* Mereset password pengguna.

### Modul Pembelajaran — `/api/modules`

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

### Konten Modul — `/api/contents`

Router konten juga dipasang secara nested pada `/api/modules/:moduleId/contents`.

- `GET /api/modules/:moduleId/contents/` `(Terautentikasi)`
  *Deskripsi:* Mengambil seluruh konten pada modul.
- `POST /api/modules/:moduleId/contents/` `(Admin)`
  *Deskripsi:* Menambahkan konten teks atau video ke modul.
- `PUT /api/modules/:moduleId/contents/:id` `(Admin)`
  *Deskripsi:* Memperbarui konten.
- `DELETE /api/modules/:moduleId/contents/:id` `(Admin)`
  *Deskripsi:* Menghapus konten.
- `GET /api/contents/` `(Terautentikasi)`
  *Deskripsi:* Route langsung untuk mengambil konten; controller menggunakan parameter `moduleId`.
- `POST /api/contents/` `(Admin)`
  *Deskripsi:* Route langsung untuk membuat konten; controller menggunakan parameter `moduleId`.
- `PUT /api/contents/:id` `(Admin)`
  *Deskripsi:* Memperbarui konten berdasarkan ID.
- `DELETE /api/contents/:id` `(Admin)`
  *Deskripsi:* Menghapus konten berdasarkan ID.

### Evaluasi Modul — `/api/evaluations`

Router evaluasi juga dipasang secara nested pada `/api/modules/:moduleId/evaluations`.

- `GET /api/modules/:moduleId/evaluations/` `(Terautentikasi)`
  *Deskripsi:* Mengambil evaluasi pada modul.
- `GET /api/modules/:moduleId/evaluations/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil detail evaluasi beserta soal.
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
  *Deskripsi:* Mengambil jawaban semua pengguna pada evaluasi.
- `GET /api/modules/:moduleId/evaluations/:id/my-answers` `(Terautentikasi)`
  *Deskripsi:* Mengambil jawaban pengguna saat ini.
- `GET /api/evaluations/` `(Terautentikasi)`
  *Deskripsi:* Route langsung untuk mengambil evaluasi; controller menggunakan parameter `moduleId`.
- `GET /api/evaluations/:id` `(Terautentikasi)`
  *Deskripsi:* Mengambil detail evaluasi beserta soal.
- `POST /api/evaluations/` `(Admin)`
  *Deskripsi:* Route langsung untuk membuat evaluasi; controller menggunakan parameter `moduleId`.
- `POST /api/evaluations/:id/questions` `(Admin)`
  *Deskripsi:* Menambahkan soal evaluasi.
- `PUT /api/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Memperbarui soal evaluasi.
- `DELETE /api/evaluations/questions/:questionId` `(Admin)`
  *Deskripsi:* Menghapus soal evaluasi.
- `POST /api/evaluations/:id/submit` `(Guru)`
  *Deskripsi:* Mengirim jawaban evaluasi.
- `GET /api/evaluations/:id/answers` `(Admin)`
  *Deskripsi:* Mengambil jawaban seluruh pengguna pada evaluasi.
- `GET /api/evaluations/:id/my-answers` `(Terautentikasi)`
  *Deskripsi:* Mengambil jawaban pengguna saat ini.

### Progress Belajar — `/api/progress`

- `GET /api/progress/` `(Admin atau Guru)`
  *Deskripsi:* Mengambil seluruh progress pengguna saat ini.
  *Catatan:* Setiap item pada `data` kini menyertakan status per tahap (`preTestCompleted`, `materialCompleted`, `postTestCompleted`) per guru per modul. Lihat **Status Progress Per Tahap** di bawah.
- `GET /api/progress/summary` `(Terautentikasi)`
  *Deskripsi:* Mengambil ringkasan progress seluruh modul pengguna saat ini.
- `POST /api/progress/:moduleId/start` `(Admin atau Guru)`
  *Deskripsi:* Memulai modul untuk pengguna saat ini.
- `POST /api/progress/:moduleId/complete` `(Admin atau Guru)`
  *Deskripsi:* Menandai modul selesai untuk pengguna saat ini.
- `GET /api/progress/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengambil progress pengguna pada satu modul.
  *Catatan:* Response juga menyertakan `preTestCompleted`, `materialCompleted`, `materialProgress`, `materialDetail`, dan `postTestCompleted` untuk modul tersebut.
- `POST /api/progress/contents/:contentId/complete` `(Admin atau Guru)`
  *Deskripsi:* Menandai satu learning material selesai untuk pengguna saat ini.
  *Catatan:* Untuk material bertipe `video`, wajib sudah mencapai `progressPercent` 100% (lihat rule completion material).
- `POST /api/progress/contents/:contentId/progress` `(Admin atau Guru)`
  *Deskripsi:* Menyimpan progress material (mis. video watched percentage) untuk pengguna saat ini.
  *Body:* `{ "progressPercent": 0-100 }`. Material otomatis dianggap selesai bila mencapai 100.

#### Status Progress Per Tahap (Stage-level)

Frontend guru membutuhkan status kelulusan tiap tahap di dalam satu modul dengan urutan:

```text
Pre-Test → Learning Material → Post-Test
```

Setiap item pada `GET /api/progress/` dan response `GET /api/progress/:moduleId` menyertakan field tambahan tanpa menghapus field lama:

```json
{
  "moduleId": "…",
  "preTestCompleted": false,
  "materialCompleted": false,
  "postTestCompleted": false,
  "materialProgress": { "total": 5, "completed": 3 },
  "materialDetail": [
    { "contentId": "…", "tipe": "video", "hasMiniQuiz": false, "isCompleted": false, "progressPercent": 40 }
  ]
}
```

- **`preTestCompleted`** — Guru sudah **submit pre-test** (ditandai dengan adanya jawaban pada evaluasi bertipe `pre_test` di modul tersebut). Ini berarti "sudah dikerjakan", **bukan** "lulus" (pre-test memang tidak memakai passing grade). Jika modul **tidak punya pre-test**, nilainya `true` (pre-test dianggap tidak diperlukan).
- **`postTestCompleted`** — Skor utama guru (`user_progress.skor`) sudah **≥ passingScore** post-test. Berarti "lulus post-test", bukan sekadar membuka. Jika modul **tidak punya post-test**, nilainya `true`.
- **`materialCompleted`** — `true` hanya bila **seluruh** learning material pada modul sudah memenuhi aturan completion-nya. Modul tanpa material → `true`. Lihat *Completion Learning Material* di bawah.
- **`materialProgress`** — ringkasan `{ total, completed }` jumlah material wajib selesai pada modul.
- **`materialDetail`** — status completion per material (opsional, membantu FE menandai tiap item).

Status dihitung **per guru per modul** (selalu memakai `userId` dari token), tidak pernah mengambil data guru lain.

#### Completion Learning Material

Material **tidak** dianggap selesai hanya karena halaman dibuka / endpoint diakses / klik. Completion berasal dari state yang tersimpan:

| Tipe material | Aturan completion |
|---|---|
| `video` | `user_content_progress.progressPercent >= 100` (ditonton sampai selesai). Endpoint `POST /contents/:contentId/progress`. |
| `pdf` | `user_content_progress.isCompleted = true` (ditandai via `POST /contents/:contentId/complete`). |
| `teks` | `user_content_progress.isCompleted = true` (ditandai via `POST /contents/:contentId/complete`). |
| `link` | `user_content_progress.isCompleted = true` (ditandai via `POST /contents/:contentId/complete`). |
| material ber-**mini quiz** | seluruh mini-quiz pada material tsb wajib **lulus** (`MiniQuizAttempt.isLolos = true`). Bila material juga punya `user_content_progress`, keduanya wajib terpenuhi. |

**Batas yang terdokumentasi (keterbatasan):** sistem belum memiliki tracking per-halaman/hitungan menit untuk `pdf`; completion `pdf`/`teks`/`link` bergantung pada penandaan eksplisit guru (`isCompleted`). Video memakai `progressPercent` sehingga FE wajib mengirim posisi tonton. Tidak ada mekanisme "interactive checkpoint" tersendiri — checkpoint diwakili oleh mini-quiz bertimestamp (`MiniQuiz.timestampSeconds`).

### Rencana Tindak Lanjut — `/api/rtl`

- `POST /api/rtl/upload` `(Terautentikasi)`
  *Deskripsi:* Menyimpan submission RTL pengguna saat ini, termasuk URL PDF dan data modul.
- `GET /api/rtl/module/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengambil RTL pengguna saat ini pada modul tertentu.
- `GET /api/rtl/submissions` `(Pengajar atau Admin)`
  *Deskripsi:* Mengambil seluruh submission RTL; mendukung query `status` dan `moduleId`.
- `PATCH /api/rtl/:rtlId/review` `(Pengajar atau Admin)`
  *Deskripsi:* Meninjau RTL dengan status `disetujui` atau `ditolak` serta `catatanTrainer`.
- `GET /api/rtl/:rtlId` `(Pengajar atau Admin)`
  *Deskripsi:* Mengambil detail satu submission RTL.
- `DELETE /api/rtl/:rtlId` `(Admin)`
  *Deskripsi:* Menghapus submission RTL.

### Mini Kuis — `/api/mini-quizzes`

- `GET /api/mini-quizzes/content/:contentId` `(Terautentikasi)`
  *Deskripsi:* Mengambil mini kuis pada konten.
- `POST /api/mini-quizzes/content/:contentId` `(Admin)`
  *Deskripsi:* Membuat mini kuis pada konten.
- `GET /api/mini-quizzes/content/:contentId/check-lock` `(Terautentikasi)`
  *Deskripsi:* Memeriksa status penguncian konten bagi pengguna saat ini.
- `PUT /api/mini-quizzes/questions/:id` `(Admin)`
  *Deskripsi:* Memperbarui soal mini kuis.
- `DELETE /api/mini-quizzes/questions/:id` `(Admin)`
  *Deskripsi:* Menghapus soal mini kuis.
- `PUT /api/mini-quizzes/:id` `(Admin)`
  *Deskripsi:* Memperbarui header mini kuis.
- `DELETE /api/mini-quizzes/:id` `(Admin)`
  *Deskripsi:* Menghapus mini kuis beserta soal-soalnya.
- `POST /api/mini-quizzes/:id/questions` `(Admin)`
  *Deskripsi:* Menambahkan soal pada mini kuis.
- `GET /api/mini-quizzes/:id/my-attempts` `(Guru atau Pengajar)`
  *Deskripsi:* Mengambil riwayat percobaan pengguna saat ini.
- `POST /api/mini-quizzes/:id/attempt` `(Guru atau Pengajar)`
  *Deskripsi:* Mengirim jawaban dan mencatat percobaan mini kuis.

Router mini kuis yang sama juga tersedia melalui mount konten berikut:

```text
/api/contents/:contentId/mini-quiz
/api/modules/:moduleId/contents/:contentId/mini-quiz
```

Kedua mount tersebut menggunakan metode, sufiks route, dan hak akses yang sama dengan daftar mini kuis di atas.

### Unggah Berkas — `/api/upload`

Endpoint menggunakan `multipart/form-data`; format yang diterima adalah JPEG, PNG, WebP, dan PDF.

- `POST /api/upload/foto-profil` `(Terautentikasi)`
  *Deskripsi:* Mengunggah gambar profil melalui field `foto`, lalu memperbarui `fotoProfil` pengguna. Batas fitur profil adalah 5 MB.
- `POST /api/upload/rtl` `(Terautentikasi)`
  *Deskripsi:* Mengunggah dokumen RTL PDF melalui field `file` ke bucket `rtl-files`; batas ukuran Multer saat ini 10 MB.

> **Catatan implementasi:** Multer saat ini memakai batas global 10 MB. Karena itu, batas 5 MB untuk foto profil belum diterapkan secara terpisah pada source.

### Umpan Balik — `/api/feedbacks`

- `POST /api/feedbacks/module/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengirim saran dan kritik untuk modul.
- `GET /api/feedbacks/` `(Admin)`
  *Deskripsi:* Mengambil seluruh saran dan kritik modul.

### Monitoring — `/api/admin`

- `GET /api/admin/users/:userId/progress` `(Admin atau Pengajar)`
  *Deskripsi:* Mengambil progress modul seorang pengguna.
- `GET /api/admin/users/:userId/evaluations` `(Admin atau Pengajar)`
  *Deskripsi:* Mengambil data evaluasi seorang pengguna.

### Helpdesk — `/api/helpdesk`

- `POST /api/helpdesk/tickets` `(Terautentikasi)`
  *Deskripsi:* Membuat tiket bantuan.
- `GET /api/helpdesk/tickets/my` `(Terautentikasi)`
  *Deskripsi:* Mengambil seluruh tiket milik pengguna saat ini.
- `GET /api/helpdesk/tickets` `(Admin atau Pengajar)`
  *Deskripsi:* Mengambil seluruh tiket bantuan.
- `PATCH /api/helpdesk/tickets/:ticketId/status` `(Admin atau Pengajar)`
  *Deskripsi:* Memperbarui status tiket.
- `GET /api/helpdesk/tickets/:ticketId` `(Pemilik tiket, Admin, atau Pengajar)`
  *Deskripsi:* Mengambil detail tiket.
- `POST /api/helpdesk/tickets/:ticketId/replies` `(Pemilik tiket, Admin, atau Pengajar)`
  *Deskripsi:* Menambahkan balasan pada tiket.

### Komentar Modul — `/api/comments`

- `POST /api/comments` `(Terautentikasi)`
  *Deskripsi:* Mengirim komentar yang terikat pada `moduleId`.
- `GET /api/comments/module/:moduleId` `(Terautentikasi)`
  *Deskripsi:* Mengambil komentar modul dengan urutan terbaru terlebih dahulu.
- `DELETE /api/comments/:id` `(Pemilik komentar atau Admin)`
  *Deskripsi:* Menghapus komentar milik sendiri; admin dapat menghapus komentar apa pun.

---

## 📝 Lisensi

Aplikasi ini dikembangkan untuk kebutuhan platform LMS Pancawaluya.
