# Handoff — Stage-Level Progress (Pre-Test → Material → Post-Test)

Dokumen ini mencatat SATU perubahan fitur yang dibatasi scope-nya: menyediakan
**status completion per tahap** untuk FE Guru, tanpa mengubah database/schema.

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

---

## 1. Latar Belakang

FE Guru hanya menerima status **module-level** (`belum_mulai` / `sedang_belajar` /
`selesai`) dari `GET /api/progress`. Status ini tidak cukup untuk menentukan status
tiap tahap di dalam satu modul:

```text
Pre-Test → Learning Material → Post-Test
```

Kebutuhan: BE menyediakan `preTestCompleted`, `materialCompleted`,
`postTestCompleted` per **guru** per **modul**.

---

## 2. Audit Existing (ringkas)

Flow progress:

```text
GET /api/progress
  → progress.route.js (authMiddleware + roleMiddleware('admin','guru'))
  → progress.controller.getProgress  → { sukses, jumlah, data }
  → progress.service.getProgress(userId)
      → prisma.user_progress.findMany({ where: { userId } })
```

Sumber data existing yang dipakai:

| Tahap | Sumber data existing | Catatan |
|---|---|---|
| Pre-Test | `user_answers` pada `question.evaluation.tipe = 'pre_test'` | `user_progress.preTestSkor` **tidak pernah ditulis** oleh kode mana pun → tidak dapat dipakai. |
| Material | `MiniQuizAttempt.isLolos` untuk seluruh mini-quiz pada `Content` modul | Tidak ada tabel progress per-content; mini-quiz adalah satu-satunya sinyal completion material. |
| Post-Test | `user_progress.skor` vs `evaluation.passingScore` (`tipe='post_test'`) | Persis logika yang sudah dipakai `courses.service.js`. |

**Temuan:** `user_progress.preTestSkor` hanya dibaca (di `courses.service.js`) dan
tidak pernah diisi, sehingga pendekatan `preTestSkor > 0` selalu `false`. Karena itu
`preTestCompleted` diturunkan dari keberadaan jawaban pre-test.

> **Catatan:** mendefinisikan `materialCompleted` per-content secara eksplisit
> membutuhkan model progress per-content (SCHEMA CHANGE). Untuk menjaga batasan
> "no schema change", dipilih definisi berbasis mini-quiz (lihat di bawah). Ini
> dilaporkan sebagai temuan dan disetujui oleh pemilik produk.

---

## 3. Contract Status yang Diimplementasikan

Semua status diturunkan dari data **existing** (READ-only), tanpa kolom/tabel baru,
**per guru per modul** (selalu memakai `userId` dari token).

### `preTestCompleted`
- **Definisi:** modul **tidak punya** evaluasi `pre_test` **ATAU** guru **sudah submit**
  pre-test (ada minimal 1 baris `user_answers` untuk soal pada evaluasi `pre_test`
  modul tersebut milik guru tsb).
- **"Selesai" ≠ "lulus":** pre-test tidak memakai passing grade, jadi cukup "sudah
  dikerjakan". Distinction ini dipertahankan sesuai implementasi existing.
- Modul tanpa pre-test → `true` (tidak terkunci).

### `materialCompleted`
- **Definisi:** modul **tidak punya** mini-quiz **ATAU** **seluruh** mini-quiz pada
  materi modul sudah **lulus** (`MiniQuizAttempt` dengan `isLolos = true`).
- Konsisten 100% dengan aturan auto-complete module yang sudah ada di
  `mini-quiz.service.js` (`submitAttempt`).
- Modul tanpa mini-quiz → `true` (materi dianggap tidak diperlukan).

### `postTestCompleted`
- **Definisi:** modul **tidak punya** evaluasi `post_test` **ATAU**
  `user_progress.skor >= postTest.passingScore` (default 80 bila null).
- Berarti **"lulus"**, bukan sekadar membuka post-test.
- Modul tanpa post-test → `true`.

---

## 4. Edge Case Behavior

| Kondisi | Perilaku |
|---|---|
| Modul tanpa Pre-Test | `preTestCompleted = true` → material langsung dapat dibuka (tidak difake, tidak ada record palsu). |
| Modul tanpa Learning Material (tanpa mini-quiz) | `materialCompleted = true` → post-test dapat dibuka setelah prasyarat sebelumnya terpenuhi. Tidak ada record palsu. |
| Modul tanpa Pre-Test DAN tanpa Material | `preTestCompleted = true`, `materialCompleted = true` → post-test dapat terbuka langsung bila modul punya post-test. |
| Modul tanpa Post-Test | `postTestCompleted = true` (state jelas & konsisten; bukan error). |

Status hanya dihitung dari data guru yang sedang login. Tidak ada penulisan data.

---

## 5. Endpoint / API Contract yang Berubah

Tidak ada endpoint baru, tidak ada endpoint dihapus, tidak ada field lama dihapus.

### `GET /api/progress/` `(Admin atau Guru)`
- Struktur respons tetap: `{ sukses, jumlah, data: [...] }`.
- **Ditambahkan** ke setiap item `data`:
  - `preTestCompleted` (boolean)
  - `materialCompleted` (boolean)
  - `postTestCompleted` (boolean)
- Field lama (`id`, `status`, `completedAt`, `module{…}`) **tetap utuh**.

### `GET /api/progress/:moduleId` `(Terautentikasi)`
- Struktur respons tetap: `{ sukses, data }`.
- **Ditambahkan** `preTestCompleted`, `materialCompleted`, `postTestCompleted`
  baik saat ada baris progress maupun saat belum ada (kondisi `belum_mulai`).

`GET /api/progress/summary` **tidak diubah** (di luar scope kebutuhan ini).

---

## 6. File yang Diubah

- `src/modules/progress/progress.service.js`
  - Menambah helper `hitungStageCompletion(userId, moduleIds)` (READ-only).
  - `getProgress` diperluas dengan 3 field status tahap.
  - `getProgressByModule` diperluas dengan 3 field status tahap.
- `README.md` — dokumentasi endpoint + definisi status + edge case.
- `handoff.md` — dokumen ini.

**Tidak diubah:** `schema.prisma`, migrasi apa pun, modul lain, auth/authorization,
API contract existing.

---

## 7. Testing / Verifikasi yang Dilakukan

Infrastruktur testing otomatis **tidak tersedia** di repo (tidak ada jest/mocha/
vitest maupun script `test`), sehingga tidak ditambahkan framework baru (di luar scope).

Verifikasi yang dilakukan (non-destruktif):

1. **Uji logika (unit-like) — 7 case** terhadap salinan fungsi murni:
   - CASE 1 Pre-Test belum selesai → `false,false,false` ✔
   - CASE 2 Pre-Test selesai, material belum → `true,false,false` ✔
   - CASE 3 Pre-Test + material selesai → `true,true,false` ✔
   - CASE 4 Ketiganya selesai → `true,true,true` ✔
   - CASE 5 Modul tanpa Pre-Test → `preTestCompleted=true` ✔
   - CASE 6 Modul tanpa Material → `materialCompleted=true` ✔
   - CASE 7 Isolasi antar-user (status User A ≠ User B) ✔
2. **Verifikasi terhadap DB nyata (READ-only, tanpa write/migrasi):**
   - `getProgress` dan `getProgressByModule` dieksekusi terhadap data existing;
     field lama tetap ada, field baru muncul, dan pada modul nyata
     ("Kesehatan & Keseimbangan Diri" dengan `pre_test`+`post_test`+2 mini-quiz)
     guru tanpa percobaan menghasilkan `{pre:false, mat:false, post:false}` (sesuai CASE 1).
   - Tidak ada perintah `prisma migrate`, `db push`, `reset`, `seed`, atau DELETE/TRUNCATE.

---

## 8. Dampak & Batasan

- **Dampak**: FE dapat menentukan kunci/buka tiap tahap dari satu endpoint.
- **Batasan**: `materialCompleted` hanya mencerminkan mini-quiz. Material non-kuis
  (teks/video/pdf/link tanpa mini-quiz) tidak memiliki sinyal "selesai" tersendiri
  karena belum ada tabel progress per-content. Bila di masa depan ingin per-content
  yang eksplisit → perlu SCHEMA CHANGE (model `user_content_progress` + endpoint
  penanda selesai), di luar scope perubahan ini.
- `GET /api/progress` tetap hanya mengembalikan modul yang sudah punya baris
  `user_progress` (perilaku lama tidak diubah).

---

## 9. Out of Scope — ditemukan tetapi tidak diubah

Temuan berikut dicatat untuk pekerjaan hardening terpisah dan **tidak diubah**:

- **OUT OF SCOPE** — `user_progress.preTestSkor` dibaca `courses.service.js` namun
  tidak pernah ditulis → `courses` menganggap pre-test selalu belum selesai.
- **OUT OF SCOPE** — School-scoping belum diterapkan di banyak modul.
- **OUT OF SCOPE** — Skoring mini-quiz/evaluasi dapat melebihi 100% (tidak ada dedup
  `questionId`).
- **OUT OF SCOPE** — `progress.completeModule` mem-bypass gerbang mini-quiz.
- **OUT OF SCOPE** — Error handling/HTTP status tidak konsisten.
- **OUT OF SCOPE** — Isu `.env`/secret, rate limiting, validasi upload, dll.

---

## 10. Catatan Implementasi (tanpa perubahan DB)

- Perubahan HANYA menambah operasi **READ** pada `evaluation`, `user_answers`,
  `content`, `miniQuiz`/`MiniQuizAttempt`, dan `user_progress`.
- Tidak ada `create`/`update`/`delete` baru pada jalur ini.
- Tidak ada migrasi, tidak ada `db push`, tidak ada reset, tidak ada seeding.
- **Prisma schema: TIDAK ADA perubahan.**

---
---

# Iterasi 2 — Material Completion Tracking (DENGAN perubahan schema, disetujui)

> ⚠️ Iterasi ini **membatalkan** batasan "no schema change" dari Iterasi 1, **atas
> persetujuan pemilik produk** setelah BE melaporkan `SCHEMA/DATA TRACKING CHANGE REQUIRED`.

## 11. Latar Belakang Iterasi 2

`materialCompleted` versi Iterasi 1 hanya mencerminkan mini-quiz. Material
`teks`/`video`/`pdf`/`link` **tanpa** mini-quiz tidak punya sinyal completion
sehingga dianggap "selesai" secara keliru. FE membutuhkan completion berbasis
state nyata, bukan page visit.

## 12. Audit Tracking Existing (Iterasi 2)

| Jenis material | State completion existing | Kesimpulan |
|---|---|---|
| video | ❌ tidak ada (tidak ada watched seconds/percent) | Tidak bisa ditrack → butuh data baru |
| pdf | ❌ tidak ada | Tidak bisa ditrack → butuh data baru |
| teks | ❌ tidak ada | Tidak bisa ditrack → butuh data baru |
| link | ❌ tidak ada | Tidak bisa ditrack → butuh data baru |
| interactive/checkpoint | ❌ tidak ada (tipe pun tidak ada di enum) | Tidak ada mekanisme |
| mini-quiz | ✅ `MiniQuizAttempt.isLolos` | Bisa ditrack |

Bukti: pencarian `src/` untuk `watch|checkpoint|content.*progress|percentage|ditonton|dibaca|dilihat` → tidak ada. `prisma.contentProgress`/`userContentProgress` → `undefined`. Sehingga dilaporkan `SCHEMA/DATA TRACKING CHANGE REQUIRED`.

## 13. Perubahan Schema (Iterasi 2)

Model baru `user_content_progress` (progress material per guru per content):

```prisma
model user_content_progress {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")
  contentId       String    @map("content_id")
  isCompleted     Boolean   @default(false) @map("is_completed")
  progressPercent Int       @default(0) @map("progress_percent")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([userId, contentId])
  @@index([userId])
  @@index([contentId])
  @@map("user_content_progress")
}
```

Relasi balik ditambahkan di `User` (`contentProgress`) dan `Content` (`contentProgress`).

Migration: `prisma/migrations/20260916122547_add_user_content_progress/migration.sql`
(hanya `CREATE TABLE` + index + 2 foreign key; **tidak** menyentuh tabel existing).

## 14. Material Completion Contract (Iterasi 2)

Material selesai **hanya** dari state tersimpan, bukan page visit:

| Tipe | Aturan |
|---|---|
| video | `progressPercent >= 100` |
| pdf | `isCompleted = true` (via endpoint complete) |
| teks | `isCompleted = true` (via endpoint complete) |
| link | `isCompleted = true` (via endpoint complete) |
| ber-mini-quiz | seluruh mini-quiz lulus (`isLolos`); bila ada `user_content_progress` juga, keduanya wajib |

`materialCompleted = semua content pada modul memenuhi aturan` (modul tanpa content → `true`).

## 15. Stage Completion Contract (final)

- **preTestCompleted** — tidak ada pre-test → `true`; ada → `true` bila ada `user_answers` pada evaluasi `pre_test` (sudah submit, bukan harus lulus).
- **materialCompleted** — tidak ada material → `true`; ada → seluruh material memenuhi aturan di §14.
- **postTestCompleted** — tidak ada post-test → `true`; ada → `user_progress.skor >= passingScore`.
- Semua per guru per modul.

## 16. Endpoint Baru (Iterasi 2)

- `POST /api/progress/contents/:contentId/complete` `(Admin atau Guru)`
  — menandai material selesai. Video ditolak bila `progressPercent < 100`.
- `POST /api/progress/contents/:contentId/progress` `(Admin atau Guru)`
  — body `{ progressPercent: 0-100 }`; menyimpan progress & auto-complete bila ≥100.

Response `GET /api/progress` & `GET /api/progress/:moduleId` ditambah:
`materialProgress: { total, completed }` dan `materialDetail: [...]`.
Field lama **tidak dihapus** (backward compatible).

## 17. Edge Case (Iterasi 2)

1. Modul tanpa Pre-Test → `preTestCompleted=true`, material terbuka.
2. Modul tanpa Material → `materialCompleted=true`, post-test terbuka.
3. Tanpa Pre-Test & Material → keduanya `true`.
4. Modul tanpa Post-Test → `postTestCompleted=true`.
5. Modul dengan material tanpa mekanisme completion → **kini ditangani** lewat
   `user_content_progress` (material dianggap belum selesai sampai ditandai).
   Tidak ada lagi false-positive.

## 18. Testing (Iterasi 2)

- **Unit test logika murni** (13 case): union mini-quiz + content progress, video
  threshold, campuran material → semua **PASS**.
- **Service-level test dengan Prisma di-mock** memuat `progress.service.js` asli
  (22 assert): CASE1–CASE9 termasuk isolasi user dan penolakan video <100% → semua **PASS**.
- **Boot test**: seluruh modul progress + `src/index.js` dimuat tanpa error.
- **Verifikasi DB (read-only)**: tabel `user_content_progress` terkonfirmasi dibuat;
  tidak ada tabel existing yang berubah; tidak ada operasi destruktif.

> Catatan environment: `.env` pada working copy menunjuk ke database yang **stale**
> (hanya berisi tabel dari migrasi awal; kolom `users.status`, tabel `mini_quizzes`,
> dll tidak ada). Karena itu integrasi penuh dengan mini-quiz tidak dapat dijalankan
> pada DB tersebut tanpa perubahan struktur (dilarang). Verifikasi service dilakukan
> dengan mock. **Ini keterbatasan environment, bukan bug kode.**

## 19. Out of Scope — ditemukan tetapi tidak diubah (Iterasi 2)

- **OUT OF SCOPE** — `.env` pada working copy menunjuk DB stale/mismatch schema.
- **OUT OF SCOPE** — `user_progress.preTestSkor` dibaca `courses.service.js` tapi tidak pernah ditulis.
- **OUT OF SCOPE** — School-scoping, skoring >100%, `completeModule` bypass, error handling, rate limiting, dll.

## 20. Cara Rollback Migration (bila perlu)

Migration ini **additive** (hanya tabel baru). Rollback aman = drop tabel baru:
`DROP TABLE "user_content_progress";` (manual, tidak dijalankan). Tidak ada data
existing yang terpengaruh.

---
---

# Iterasi 3 — Fitur Sertifikat (Course Completion Certificate)

Dokumen ini mencatat SATU perubahan fitur yang dibatasi scope-nya: **sistem
sertifikat** untuk LMS Pancawaluya. Tanggal: diisi saat commit. Tidak ada secret
pada dokumen ini.

## 21. Latar Belakang (Iterasi 3)

User (guru) harus menyelesaikan **seluruh course** sebelum boleh mengklaim
sertifikat:

```text
COURSE 100% COMPLETE → claim certificate → certificate dibuat (nama dari profil)
```

## 22. Audit Existing (Iterasi 3)

| Aspek | Temuan |
|---|---|
| Sumber Course/Module | Tabel `courses` & `modules`; relasi `Module.courseId -> Course.id` (nullable, `onDelete: Cascade`). |
| Cara hitung completion | `progress.service.hitungStageCompletion(userId, moduleIds)` — menghitung `preTestCompleted`, `materialCompleted`, `postTestCompleted` per guru per module. **Dipakai ulang sebagai single source of truth.** |
| Module selesai | `preTestCompleted && materialCompleted && postTestCompleted`. Stage yang tidak tersedia = `true` (logic existing). |
| Course selesai | `jumlah module selesai === total module`. `courseProgress = round(completed/total*100)`. |
| Sumber nama | Field **`User.nama`** — satu-satunya field nama profil (dipakai `auth.middleware`, `users.service`, dll). Tidak ada field nama lain. |
| Model Certificate | **Sudah ada** di `schema.prisma` namun belum lengkap (tanpa `recipientName`, `createdAt`, `@@unique(userId,courseId)`, `fileUrl` wajib). Skema disesuaikan (additive). |
| Tabel `certificates` di DB | **Belum ada** di database yang terhubung (DB stale — lihat §26). |
| PDF/template generation | **Tidak tersedia** — tidak ada library PDF maupun aset Canva. |
| Upload/storage | Supabase Storage (`config/supabase.js`) & Cloudinary tersedia, tetapi **tidak dipakai** di iterasi ini karena belum ada berkas untuk disimpan. |
| Pola identifier unik | Ada pada `Ticket.ticketNumber` (mis. `TKT-...`). Nomor sertifikat dibuat mengikuti pola serupa. |
| Pola controller/service/route | Ada 3 gaya di repo; certificate mengikuti pola `sukses/pesan/data` + `error.statusCode` (konsisten dengan `progress.controller` & `modules.controller`). |
| Authorization | `authMiddleware` + `roleMiddleware('admin','guru')`. School-scope course mengikuti aturan existing di `courses.service.getCourseById`. |

## 23. Perubahan Schema (Iterasi 3)

Model `Certificate` (additive) — field baru/penyesuaian:

```prisma
model Certificate {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  courseId        String   @map("course_id")
  recipientName   String   @map("recipient_name")      // BARU: snapshot nama
  nomorSertifikat String   @unique @map("nomor_sertifikat")
  fileUrl         String?  @map("file_url") @db.Text   // DIUBAH: nullable
  templateId      String?  @map("template_id")         // BARU: referensi template
  status          String   @default("issued")          // BARU
  issuedAt        DateTime @default(now()) @map("issued_at")
  createdAt       DateTime @default(now()) @map("created_at") // BARU

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])  // BARU: anti-duplikat 1 sertifikat/user/course
  @@index([userId])
  @@index([courseId])
  @@map("certificates")
}
```

Relasi balik `User.certificates` & `Course.certificates` **sudah ada** sebelumnya
(tidak diubah).

Migration: `prisma/migrations/20260916140658_add_certificate/migration.sql`
(hanya `CREATE TABLE` + index + 2 FK; **tidak** menyentuh tabel existing).

## 24. Contract Fitur (Iterasi 3)

- **Eligibility**: claim hanya bila `courseProgress === 100%` (seluruh module selesai).
- **recipientName**: snapshot `User.nama` saat claim.
- **nomorSertifikat**: `PANC-<TAHUN>-<8 hex acak>`, unik.
- **Idempotent**: claim ulang → `already_claimed` (nomor & `issuedAt` tidak berubah).
- **0 module** → **tidak** eligible (progress 0%).
- **hasCertificate = false** → ditolak (400).

## 25. Endpoint Baru (Iterasi 3)

- `GET /api/certificates/` `(Admin atau Guru)` — daftar sertifikat user.
- `POST /api/certificates/:courseId/claim` `(Admin atau Guru)` — klaim; `status` = `created` | `already_claimed`.
- `GET /api/certificates/:id` `(Admin atau Guru)` — detail sertifikat (pemilik/admin).

Response memakai pola `{ sukses, pesan, data }`; error memakai `error.statusCode`
(400/403/404). Tidak ada field existing yang dihapus.

## 26. Edge Case (Iterasi 3)

| # | Kondisi | Perilaku |
|---|---|---|
| 1 | Course tidak ditemukan | `404` |
| 2 | Course 0 module | **ditolak** `400` (tidak otomatis eligible) |
| 3 | Ada module belum selesai | `progress < 100%` → `400` |
| 4 | Semua module selesai | `progress = 100%` → claim dibuat |
| 5 | Sudah claim | `already_claimed`, tanpa duplikat |
| 6 | Ganti nama profil setelah issue | sertifikat lama pakai snapshot |
| 7 | Course bukan hak akses (school-scope) | `403` |
| 8–10 | Module tanpa Pre-Test / Material / Post-Test | ikut logic existing (stage absen = `true`) |
| 11 | Video belum 100% | module belum selesai (`materialCompleted=false`) |
| 12 | Mini-quiz lulus tapi material belum selesai | tidak complete |
| 13 | Material selesai tapi Post-Test belum memenuhi | tidak complete |

## 27. File yang Diubah / Ditambah (Iterasi 3)

Ditambah:
- `src/modules/certificates/certificates.service.js`
- `src/modules/certificates/certificates.controller.js`
- `src/modules/certificates/certificates.route.js`
- `prisma/migrations/20260916140658_add_certificate/migration.sql`
- `test/certificates.test.js`

Diubah:
- `prisma/schema.prisma` — model `Certificate` (additive).
- `src/index.js` — daftar `certificateRoute` di `/api/certificates`.
- `src/modules/progress/progress.service.js` — **hanya mengekspor** `hitungStageCompletion` (tidak mengubah logic).
- `package.json` — script `test`.
- `README.md` & `handoff.md`.

**Tidak diubah:** logic progress per-stage, pre-test/post-test/material/mini-quiz,
auth/authorization di luar endpoint certificate, upload system, migration lama.

## 28. Testing (Iterasi 3)

Infrastruktur framework test tidak tersedia; test standalone dibuat tanpa
menyentuh database (Prisma & progress.service di-mock):

```
node test/certificates.test.js   # atau: npm test
```

Hasil: **18 PASS, 0 FAIL** — mencakup CASE 1–13 (0%, <100%, 100%, nama profil,
snapshot, idempotency, nomor unik, school-scope, 0 module, course tak ada,
tanpa sertifikat, module tanpa stage, video belum 100%, mini-quiz vs material,
post-test belum selesai, GET list/detail, race-condition P2002).

Verifikasi lain (non-destruktif):
- `npx prisma validate` → valid.
- `npx prisma generate` → sukses.
- Boot `src/index.js` → server berjalan tanpa error.
- Migration SQL diperiksa: hanya additive.
- **Tidak** menjalankan `prisma migrate`/`db push`/`reset`/`seed` terhadap DB.

## 29. Batasan Environment

`.env` pada working copy mengarah ke database yang **stale** (hanya sebagian tabel;
`courses`/`certificates` belum ada). Karena itu migration **tidak dijalankan** ke DB
(hanya dibuat sebagai file). Ini keterbatasan environment, bukan bug kode. Untuk
menerapkan: pada environment dengan skema `courses` yang benar, jalankan
`npx prisma migrate deploy`.

## 30. Bagian yang Masih Pekerjaan FE / Lanjutan (Iterasi 3)

- **Template Canva belum tersedia** → generation PDF/gambar belum diimplementasi.
  Kolom `fileUrl` & `templateId` sudah disiapkan (nullable). Saat template siap:
  buat generator, isi `fileUrl`, ubah `status` menjadi `generated`.
- FE memanggil `POST /api/certificates/:courseId/claim` **tanpa** mengirim nama.
- **OUT OF SCOPE** — perbaikan bug/security unrelated, refactor modul lain.

## 31. Cara Rollback Migration (Iterasi 3)

Migration additive: rollback aman = `DROP TABLE "certificates";` (manual, tidak
dijalankan). Tidak ada data existing yang terpengaruh.

<br />

# Iterasi 4 — Certificate Template & PDF Generation

## 32. Latar Belakang (Iterasi 4)

Iterasi 3 hanya menerbitkan sertifikat sebagai **record** (`fileUrl` = `null`)
karena template Canva belum tersedia. Iterasi 4 mengaktifkan alur berkas:
admin meng-upload **template PDF hasil export Canva** per course, backend
meng-overlay data certificate ke template, menghasilkan **PDF personal**, dan
menyimpan URL-nya.

**Bukan** integrasi Canva API. Backend hanya memakai file PDF yang diunggah.

## 33. Audit Existing (Iterasi 4)

| Aspek | Temuan |
|---|---|
| Model `Course` | Belum punya field template certificate → perlu 3 kolom additive. |
| Model `Certificate` | Sudah punya `fileUrl`, `templateId`, `status` (dari Iterasi 3) — tidak perlu diubah. |
| Storage existing | Cloudinary (dipakai `uploadPdfModul` via `resource_type: raw`) & Supabase Storage. |
| PDF/image lib | **Tidak ada** → `pdf-lib` ditambahkan (pure-JS, tanpa native dep). |
| Pola upload | `multer.memoryStorage()` → service upload → simpan URL (`upload.route.js`). |
| Authorization | `authMiddleware` + `roleMiddleware`; school-scope mengikuti `courses.service` & `pastikanAksesCourse`. |

## 34. Perubahan Schema (Iterasi 4) — additive

Model `Course` — 3 kolom baru (semua nullable, tidak mengubah kolom existing):

```prisma
certificateTemplateUrl String? @map("certificate_template_url") @db.Text
certificateTemplateId  String? @map("certificate_template_id")
certificateOverlay     Json?   @map("certificate_overlay")
```

Migration: `prisma/migrations/20260916150147_add_course_certificate_template/migration.sql`
(hanya `ALTER TABLE "courses" ADD COLUMN` ×3; **tanpa** DROP/TRUNCATE/DELETE;
**tidak** menyentuh tabel/migration existing).

Model `Certificate` **tidak diubah**.

## 35. Dependency Baru

- **`pdf-lib@1.17.1`** — diperlukan untuk memuat template PDF sebagai background
  dan menggambar text overlay. Ini satu-satunya library yang memenuhi kebutuhan
  (alternatif seperti `puppeteer`/`sharp`/`canvas` butuh native dependency /
  browser headless, jauh lebih berat). Tidak ada integration eksternal baru.

## 36. Contract Fitur (Iterasi 4)

- **Template** = file PDF hasil export Canva yang di-upload admin; dipakai ulang
  banyak user. **Hasil certificate** = PDF personal per certificate. Dua file
  berbeda, disimpan di folder Cloudinary berbeda.
- **Storage** (Cloudinary, `resource_type: raw`):
  - template → `lms-certificate-templates/template-<courseId>`
  - hasil → `lms-certificates/certificate-<nomorSertifikat>`
- **Tidak** menyimpan file di local filesystem/backend.
- **Overlay** mempertahankan ukuran halaman, orientasi, background, dekorasi,
  dan layout template (halaman template tidak diubah).
  - Nama penerima **wajib** di-overlay; font **auto-shrink** bila kepanjangan.
  - Nomor / tanggal / nama course di-overlay **hanya bila** posisinya
    disediakan (`Course.certificateOverlay`); tidak dipaksa masuk.
  - Posisi memakai koordinat relatif (persen), default wajar untuk nama.
- **Data personal** (nama, nomor, tanggal) **selalu** dari certificate record —
  bukan dari request FE / profil live.
- **Idempotency generate**: jika `fileUrl` sudah ada → `already_generated`
  (tidak render ulang); `force=true` untuk generate ulang eksplisit.
- **Course tanpa template** → generate ditolak (`400`), tidak menghasilkan file.
- **Authorization**: admin bebas; non-admin dibatasi school-scope. User hanya
  dapat mengakses/generate certificate miliknya (kecuali admin).

## 37. Endpoint Baru (Iterasi 4)

- `POST /api/certificates/:courseId/template` `(Admin)` — upload/update template
  (`multipart/form-data`, field `file`, PDF ≤10MB).
- `GET /api/certificates/:courseId/template` `(Admin atau Guru)` — metadata
  template course.
- `POST /api/certificates/:id/generate` `(Admin atau Guru)` — generate PDF
  personal (`?force=true` opsional). Status: `generated` | `already_generated`.

Semua memakai pola response `{ sukses, pesan, data }` dan error `error.statusCode`.

## 38. Edge Case (Iterasi 4)

| # | Kondisi | Perilaku |
|---|---|---|
| 1 | Course belum punya template | generate `400` (tidak generate) |
| 2 | `certificate.fileUrl` sudah ada | `already_generated`, tidak render ulang |
| 3 | `force=true` | render ulang & overwrite `fileUrl` |
| 4 | Certificate milik user lain | `403` |
| 5 | Certificate/course tidak ada | `404` |
| 6 | Upload non-PDF | ditolak (400 / filter multer) |
| 7 | Nama sangat panjang | font auto-shrink agar muat |
| 8 | Overlay config kosong | default wajar untuk nama; field opsional tidak dipaksa |

## 39. File yang Diubah / Ditambah (Iterasi 4)

Ditambah:
- `src/modules/certificates/certificate-pdf.service.js`
- `prisma/migrations/20260916150147_add_course_certificate_template/migration.sql`
- `test/certificate-generation.test.js`

Diubah:
- `prisma/schema.prisma` — model `Course` (3 kolom additive).
- `src/modules/certificates/certificates.service.js` — tambah
  `uploadCertificateTemplate`, `getCertificateTemplate`, `generateCertificate`.
- `src/modules/certificates/certificates.controller.js` — tambah handler.
- `src/modules/certificates/certificates.route.js` — tambah 3 route + multer.
- `src/modules/upload/upload.service.js` — tambah fungsi upload template,
  upload hasil, download buffer.
- `test/certificates.test.js` — mock `upload.service` & `certificate-pdf.service`
  (agar modul tetap bisa di-require tanpa konfigurasi storage).
- `package.json` — dependency `pdf-lib`, script `test:certgen`.
- `README.md` & `handoff.md`.

**Tidak diubah:** logic progress/eligibility/claim (Iterasi 1–3), migration lama.

## 40. Testing (Iterasi 4)

Standalone, tanpa menyentuh DB/storage (Prisma, progress.service, upload.service,
& certificate-pdf.service di-mock):

```
node test/certificate-generation.test.js   # atau: npm run test:certgen
```

Hasil: **15 PASS, 0 FAIL** — mencakup: admin upload template, template tersimpan
di storage, template terhubung ke course, upload non-PDF ditolak, non-admin
school-scope ditolak (403), course tanpa template ditolak (400), generate sukses
memakai template, `recipientName` dari snapshot, hasil tersimpan + `fileUrl`
terisi, certificate user lain ditolak (403), `fileUrl` ada → tidak generate ulang,
`force=true` generate ulang, certificate/course tidak ada (404), overlay config
diteruskan.

Regresi: `node test/certificates.test.js` → **18 PASS, 0 FAIL** (tidak berubah).

Verifikasi tambahan (non-destruktif):
- `npx prisma validate` → valid.
- `npx prisma generate` → sukses.
- `pdf-lib` render uji: halaman & ukuran template dipertahankan.
- Boot `src/index.js` → server berjalan; route terdaftar dengan urutan benar.
- Migration SQL diperiksa: hanya 3 `ADD COLUMN`.
- **Tidak** menjalankan `prisma migrate`/`db push`/`reset`/`seed` terhadap DB.

## 41. Batasan Environment (Iterasi 4)

Sama seperti Iterasi 3: migration **tidak dijalankan** ke DB (hanya file). Untuk
menerapkan: `npx prisma migrate deploy` pada environment dengan skema `courses`
yang benar.

## 42. Cara Rollback Migration (Iterasi 4)

Additive: rollback aman = `ALTER TABLE "courses" DROP COLUMN ...` untuk 3 kolom
baru (manual, tidak dijalankan). Tidak ada data existing yang terpengaruh.

<br />

# Iterasi 5 — Default Positioning Overlay (Fix)

## 43. Latar Belakang (Iterasi 5)

Iterasi 4 memakai default overlay `name.y = 0.42`, `fontSize = 48`. Nilai ini
mengharuskan admin menyesuaikan `certificateOverlay` manual agar nama jatuh tepat
di area nama template. Iterasi 5 menyetel **default positioning usable** di code
sehingga template yang baru di-upload langsung dapat dipakai **tanpa konfigurasi
manual di database**.

## 44. Perubahan (Iterasi 5) — hanya default positioning

- `DEFAULT_OVERLAY.name` di `certificate-pdf.service.js` disetel mengikuti layout
  template referensi Canva **"Oranye Merah Minimalist Organic Certificate of
  Recognition.pdf"** (1 halaman, landscape 842.25 × 595.5 pt):
  - `x = 0.5` (center horizontal)
  - `y = 0.535` (area nama template)
  - `fontSize = 44`, `maxWidthPercent = 0.7`, `align = 'center'`
- Auto-shrink font tetap (nama panjang mengecil agar tidak overflow).
- `certificateOverlay` **tetap dipertahankan** untuk future flexibility; bila
  diisi, konfigurasi custom tetap dihormati (diverifikasi test).
- Elemen opsional (nomor/tanggal/course) **tidak** dipaksa; hanya di-overlay bila
  ada konfigurasinya.

**Tidak diubah:** eligibility, claim, flow upload template, schema, route, storage.

## 45. Testing (Iterasi 5)

Test baru: `test/certificate-pdf.test.js` (**5 PASS, 0 FAIL**), memakai pdf-lib
asli dengan template landscape syntetis:

- Template tanpa `certificateOverlay` tetap menghasilkan PDF.
- Hasil 1 halaman landscape (background template dipertahankan).
- `recipientName` memakai default positioning (center).
- Nama panjang auto-shrink & lebar text ≤ area (tidak overflow).
- `certificateOverlay` custom tetap dihormati.

Regresi: `certificates.test.js` **18 PASS**, `certificate-generation.test.js`
**15 PASS**.

Verifikasi tambahan: render langsung memakai template referensi Canva →
1 halaman landscape, background/dekorasi utuh, nama center di area yang benar.

## 46. Files Changed (Iterasi 5)

- `src/modules/certificates/certificate-pdf.service.js` — default positioning +
  ekspor `DEFAULT_OVERLAY` & `fitFontSize` untuk pengujian.
- `test/certificate-pdf.test.js` — **baru**.
- `package.json` — script `test:certpdf`.
- `README.md` & `handoff.md`.



---

# Handoff — Refactor Domain Evaluasi → Pre-Test & Post-Test (Task 1)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

## 1. Scope Task 1

Refactor **hanya service layer** evaluasi agar domain Pre-Test & Post-Test lebih
jelas terpisah, **tanpa** mengubah schema/database, API, scoring, passing score,
max attempts, mustRepeat, submit behavior, question logic, atau progress logic.

**Tidak ada** perubahan `prisma/schema.prisma`, migration, atau data.
**Tidak ada** perubahan route/controller/response. DELETE endpoint **belum**
diimplementasikan (menjadi Task 2).

## 2. Yang Diubah

File: `src/modules/evaluations/evaluations.service.js`

Ditambahkan (murni domain/naming, tanpa mengubah behavior):

- Konstanta domain `ASSESSMENT_TYPE = { PRE_TEST: 'pre_test', POST_TEST: 'post_test' }`
  beserta konstanta default business rule.
- Helper `isPreTestType(tipe)`.
- Helper `resolveCreateAssessmentType(tipe)` — validasi tipe untuk pembuatan baru:
  tipe kosong → default `post_test` (perilaku existing); `pre_test`/`post_test`
  dipakai apa adanya; tipe lain ditolak dengan error.
- Helper `resolveSubmitDefaults(evaluation)` — meresolusi `passingScore` dan
  `maxAttempts` saat submit (pre-test: 0/1, post-test: existing default 80/3).
- `createPreTest` / `getPreTest` dan `createPostTest` / `getPostTest`.
- `createEvaluation` tetap ada sebagai **compatibility dispatcher** yang memilih
  pre-test atau post-test.

## 3. Behavior yang Dipertahankan

- Pre-test: `passingScore = 0`, `maxAttempts = 1`, submit → modul `sedang_belajar`,
  tidak menimpa skor utama.
- Post-test: default `passingScore = 80`, default `maxAttempts = 3`, lulus →
  `selesai`, gagal → `sedang_belajar`, capai max attempts → `mustRepeat` +
  reset `belum_mulai`.
- Scoring, `user_answers` upsert, `user_progress` upsert, `completedAt`,
  pesan response, dan shape response **identik**.
- `getEvaluationsByModule`, `getEvaluationById`, `createQuestion`,
  `updateQuestion`, `deleteQuestion`, `getAnswersByEvaluation`, `getMyAnswers`
  **tidak diubah**.

## 4. Validasi Tipe (Rule 5)

Sesuai Rule 5, hanya `pre_test` dan `post_test` yang diperlakukan sebagai tipe
assessment valid untuk pembuatan baru. `createEvaluation` **menolak** tipe selain
keduanya dengan error (mis. legacy `module_eval`), dan **TIDAK** lagi mengarahkan
tipe invalid secara otomatis ke `post_test`, agar tidak terjadi silent behavior
change.

- `tipe` tidak diisi → default `post_test` (mempertahankan perilaku existing).
- `tipe` = `pre_test`/`post_test` → dipakai apa adanya.
- `tipe` = nilai lain → error "Tipe evaluasi tidak valid".

Tidak menyentuh data existing: baris lama `module_eval` tetap terbaca apa adanya
oleh fungsi GET/logic compatibility. Tidak ada migration/schema change.

## 5. Compatibility Layer

`Evaluation.tipe` tetap jadi satu-satunya sumber kebenaran persistence. Field,
Prisma model, dan enum **tidak di-rename**. Refactor ke tabel/resource terpisah
(bila diperlukan) menunggu task migration manual oleh developer.

## 6. Verifikasi

- `node -c` service/controller/route: OK.
- `npx prisma validate`: schema valid (tidak diubah).
- `npm test` (certificates.test.js): **18 PASS, 0 FAIL**.

---

# Handoff — Endpoint DELETE Assessment Pre-Test / Post-Test (Task 2)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

## 1. Scope Task 2

Menambahkan endpoint DELETE assessment untuk menyelesaikan blocker FE.
**Tidak ada** perubahan schema/migration/database, scoring, submit, attempt,
question behavior, atau progress behavior.

## 2. Endpoint Baru

```
DELETE /api/modules/:moduleId/evaluations/:evaluationId
```

- Authentication: `authMiddleware` (existing).
- Authorization: `roleMiddleware('admin')` (existing) — hanya admin.
- Route ditambahkan di `evaluations.route.js` (router `mergeParams: true`,
  sehingga `:moduleId` berasal dari mount `/api/modules/:moduleId/evaluations`).

## 3. Behavior DELETE

Service `deleteEvaluation(moduleId, evaluationId)`:

1. Cari evaluation by `evaluationId`. Jika tidak ada → **404**
   (`"Evaluasi tidak ditemukan"`).
2. Jika `evaluation.moduleId !== moduleId` → **400**, tidak menghapus
   (`"Evaluasi ini bukan milik modul tersebut"`).
3. Jika `tipe` bukan `pre_test`/`post_test` (mis. legacy `module_eval`) →
   **400**, tidak menghapus.
4. Hapus via `prisma.evaluation.delete({ where: { id } })`.
5. Pesan sukses sesuai tipe:
   - `pre_test` → `"Pre-Test berhasil dihapus"`
   - `post_test` → `"Post-Test berhasil dihapus"`

Cascade ke `question`/`option`/`user_answers` ditangani oleh FK existing
(`onDelete: Cascade`) — **tidak ada cleanup manual** dan **tidak ada
perubahan schema**.

## 4. Files Changed

- `src/modules/evaluations/evaluations.service.js` — tambah `deleteEvaluation` +
  ekspor.
- `src/modules/evaluations/evaluations.controller.js` — tambah `deleteEvaluation`
  (map `error.statusCode || 400`, 404 untuk not-found) + ekspor.
- `src/modules/evaluations/evaluations.route.js` — tambah route
  `DELETE /:evaluationId` (auth + admin).
- `test/evaluations-delete.test.js` — **baru** (8 test).
- `package.json` — script `test:evaldel`.
- `README.md` & `handoff.md`.

## 5. Verifikasi

- `node -c` service/controller/route: OK.
- `npx prisma validate`: schema valid (tidak diubah).
- `node test/evaluations-delete.test.js`: **8 PASS, 0 FAIL**.
- `npm test` (certificates.test.js): **18 PASS, 0 FAIL** (tidak ada regresi).

## 6. Catatan Root Mount

Router evaluasi juga ter-mount di `/api/evaluations` (tanpa `:moduleId`).
Route DELETE di mount tersebut tidak memiliki `moduleId`, sehingga request akan
ditolak oleh pengecekan kepemilikan modul. Endpoint resmi untuk FE adalah versi
nested `/api/modules/:moduleId/evaluations/:evaluationId`.

---

# Handoff — Split Evaluation menjadi Pre-Test & Post-Test Modules (Task 3)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

## 1. Scope Task 3

Structural refactor: memisahkan code `src/modules/evaluations/` menjadi dua
module domain `pre-tests/` dan `post-tests/`. **Tidak ada** perubahan
schema/migration/database, scoring, passing score, max attempts, mustRepeat,
progress, question/option/answer, atau certificate.

## 2. Struktur Sebelum

```text
src/modules/evaluations/
    evaluations.service.js    (semua business logic)
    evaluations.controller.js
    evaluations.route.js
```

## 3. Struktur Sesudah

```text
src/modules/pre-tests/
    pre-tests.service.js
    pre-tests.controller.js
    pre-tests.route.js

src/modules/post-tests/
    post-tests.service.js
    post-tests.controller.js
    post-tests.route.js

src/modules/evaluations/                 (compatibility layer)
    evaluation.helpers.js                (NEW — helper bersama)
    evaluations.service.js               (compatibility delegasi)
    evaluations.controller.js            (legacy, tidak berubah)
    evaluations.route.js                 (legacy, tidak berubah)
```

## 4. Helper Bersama

`src/modules/evaluations/evaluation.helpers.js` berisi business logic
type-agnostic yang **dipindah apa adanya** dari `evaluations.service.js`
(submit/scoring/question/answer/get/delete). Service Pre-Test & Post-Test
memanggil helper ini dengan tipe domain masing-masing. Tidak ada duplikasi
scoring.

## 5. Compatibility Layer

- `evaluations.service.js` **bukan lagi** business service utama. Fungsinya
  hanya delegasi ke `evaluation.helpers.js` untuk melayani endpoint legacy.
- `evaluations.controller.js` & `evaluations.route.js` dipertahankan (legacy).
- Alasan dipertahankan: masih ada mount legacy `/api/evaluations` (index.js)
  dan `/api/modules/:moduleId/evaluations` (modules.route.js). Dihapus pada
  task berikutnya setelah semua consumer pindah.

## 6. Endpoint Baru

Pre-Test: `/api/modules/:moduleId/pre-tests`
Post-Test: `/api/modules/:moduleId/post-tests`

Masing-masing: GET list, GET by id, POST create, POST `/:id/questions`,
PUT/DELETE `/questions/:questionId`, DELETE `/:id`, POST `/:id/submit`,
GET `/:id/answers`, GET `/:id/my-answers`.

Authorization mengikuti pola existing: `authMiddleware` + `roleMiddleware('admin')`
(create/delete/question), `roleMiddleware('guru')` (submit), auth-only (GET).

## 7. Domain Guard

Service domain menerapkan pengecekan tipe:
- Pre-Test hanya menerima evaluation `tipe = "pre_test"`.
- Post-Test hanya menerima evaluation `tipe = "post_test"`.
- moduleId mismatch → `400`; evaluation tidak ditemukan → `404`.
- Pre-Test tidak dapat dihapus lewat endpoint Post-Test dan sebaliknya.
- Legacy `module_eval` **tidak dihapus** dan tetap terbaca oleh endpoint legacy.

## 8. Behavior yang Dipastikan Tidak Berubah

- `submitJawaban` (scoring, progress upsert, mustRepeat, pesan) dipindah
  verbatim. Satu-satunya perbedaan kosmetik: `evaluationAda.tipe === 'pre_test'`
  → `isPreTestType(evaluationAda.tipe)` (helper identik dari Task 1).
- `resolveSubmitDefaults` diverifikasi identik dengan ternary lama
  (termasuk fallback `passingScore: 0` post_test → `80`).
- `getAnswersByEvaluation` / `getMyAnswers` identik.

## 9. Files

- **Baru:** `src/modules/pre-tests/{service,controller,route}.js`,
  `src/modules/post-tests/{service,controller,route}.js`,
  `src/modules/evaluations/evaluation.helpers.js`,
  `test/pre-post-tests.test.js`.
- **Diubah:** `src/modules/evaluations/evaluations.service.js` (jadi
  compatibility layer), `src/modules/modules/modules.route.js` (mount baru),
  `src/index.js` (tidak berubah efektif — mount tetap via modules.route),
  `package.json` (script `test:prepost`), `README.md`, `handoff.md`.
- **Tidak ada file yang dihapus** pada task ini.

## 10. Verifikasi

- `node -c` semua file service/controller/route baru & lama: OK.
- `npx prisma validate`: schema valid (tidak diubah).
- `test/pre-post-tests.test.js`: **26 PASS, 0 FAIL**.
- `test/evaluations-delete.test.js`: **8 PASS, 0 FAIL** (legacy tidak rusak).
- `npm test` (certificates): **18 PASS, 0 FAIL**.
- `test:certgen` 15 PASS, `test:certpdf` 5 PASS — tidak ada regresi.

---

# Handoff — Migrate Consumers ke Pre-Test / Post-Test (Task 4)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

## 1. Ringkasan

Task 4 adalah audit + migrasi consumer internal. Hasil audit: **tidak ada
consumer internal backend yang membutuhkan `evaluations.service.js` sebagai
business logic utama.** Migrasi ini sudah tuntas pada Task 3 (module
`pre-tests` / `post-tests` + `evaluation.helpers.js`). Task 4 memverifikasi
dan mendokumentasikan state tersebut.

**Tidak ada perubahan kode** pada Task 4 (hanya dokumentasi). Alasannya:
- Tidak ada consumer internal baru yang perlu dimigrasikan.
- Consumer yang ada memakai Prisma model langsung (diizinkan Task 4 #3).
- Perubahan lain akan bersifat cosmetic/unrelated (dilarang).

## 2. Audit Consumer

| Consumer | Jenis dependency | Kategori | Aksi |
|---|---|---|---|
| `src/index.js` | `require(evaluations.route)` (mount `/api/evaluations`) | C legacy compat | Pertahankan |
| `src/modules/modules/modules.route.js` | `require(evaluations.route)` (`/:moduleId/evaluations`) | C legacy compat | Pertahankan |
| `src/modules/evaluations/evaluations.controller.js` | `require(evaluations.service)` | C (adapter legacy) | Pertahankan |
| `src/modules/evaluations/evaluations.route.js` | `require(evaluations.controller)` | C | Pertahankan |
| `src/modules/evaluations/evaluations.service.js` | `require(evaluation.helpers)` (delegasi) | C adapter | Pertahankan |
| `src/modules/pre-tests/pre-tests.service.js` | `require(evaluation.helpers)` | A (domain baru) | Sudah benar |
| `src/modules/post-tests/post-tests.service.js` | `require(evaluation.helpers)` | B (domain baru) | Sudah benar |
| `src/modules/progress/progress.service.js` | raw `prisma.evaluation` + `tipe` | C/D (raw Prisma existing) | Tidak diubah |
| `src/modules/admin-monitoring/admin-monitoring.service.js` | raw `prisma.evaluation` | C/D | Tidak diubah |
| `src/modules/courses/courses.service.js` | relasi Prisma `module.evaluations` + `tipe` | C/D | Tidak diubah |
| `src/modules/modules/modules.service.js` | relasi Prisma `evaluations` (count/include) | C/D | Tidak diubah |
| `src/modules/admin-monitoring/admin-monitoring.route.js` | literal path `/users/:userId/evaluations` | D (naming lain) | Tidak diubah |
| `src/modules/certificates/*` | **tidak ada** dependency Evaluation | — | Tidak diubah |
| `test/evaluations-delete.test.js` | `require(evaluations.service/.controller)` | D (test legacy) | Pertahankan |

## 3. Consumer yang Dimigrasikan

Tidak ada consumer internal tersisa yang perlu dimigrasikan pada Task 4 —
seluruh business logic assessment sudah berada di module domain
(`pre-tests`, `post-tests`) sejak Task 3.

## 4. Consumer yang Sengaja Tetap Pakai Compatibility Layer

- Endpoint legacy `/api/evaluations` dan `/api/modules/:moduleId/evaluations`
  (via `evaluations.route.js` → `evaluations.controller.js` →
  `evaluations.service.js` adapter → `evaluation.helpers.js`).
- Modul `progress`, `courses`, `modules`, `admin-monitoring`: membaca
  `prisma.evaluation` langsung untuk data existing (TIDAK menggunakan
  `evaluations.service.js`). Ini diizinkan Task 4 #3 dan tidak mengubah
  behavior.

## 5. Progress & Certificate

- Progress tetap mengenali `pre_test` / `post_test` dari `evaluation.tipe`
  (tidak ada perubahan; stage completion, material unlock, post-test
  completion tidak disentuh).
- Certificate: **tidak memiliki dependency** ke Evaluation → tidak diubah.

## 6. Referensi `/evaluations` yang Masih Tersisa

- `src/index.js` (mount `/api/evaluations`) — legacy endpoint dipertahankan.
- `src/modules/modules/modules.route.js` (mount `/:moduleId/evaluations`) — legacy.
- `src/modules/evaluations/*` — folder compatibility layer (belum dihapus,
  sesuai Task 4 #1).
- `src/modules/admin-monitoring/admin-monitoring.route.js` — path string
  `/users/:userId/evaluations` (endpoint monitoring users, BUKAN assessment
  evaluation; tidak berhubungan dan tidak diubah).

Semua sisa referensi adalah **legacy compatibility yang sengaja
dipertahankan**, bukan consumer yang lupa dimigrasikan.

## 7. Dependency `evaluations.service.js` yang Tersisa

Hanya:
- `src/modules/evaluations/evaluations.controller.js` (adapter legacy — memang
  layer compatibility).
- `test/evaluations-delete.test.js` (test layer legacy).

Tidak ada module backend lain yang bergantung pada `evaluations.service.js`.

## 8. Verifikasi

- `npm run test:prepost`: **26 PASS, 0 FAIL**
- `npm run test:evaldel`: **8 PASS, 0 FAIL**
- `npm test` (certificates): **18 PASS, 0 FAIL**
- `npm run test:certgen`: **15 PASS, 0 FAIL**
- `npm run test:certpdf`: **5 PASS, 0 FAIL**
- `npx prisma validate`: schema valid (tidak diubah).
- `git diff -- prisma/schema.prisma`: kosong.

## 9. Files Changed (Task 4)

- `README.md` — perjelas arsitektur adapter legacy + status consumer internal.
- `handoff.md` — section Task 4 ini.

Tidak ada file kode (`src/`, `test/`, `prisma/`) yang diubah pada task ini.

---

# Handoff — Remove Legacy Evaluation Code (Task 5)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.

## 1. Ringkasan

Menghapus compatibility layer `src/modules/evaluations/` karena seluruh
business logic sudah dipisahkan ke `pre-tests/` dan `post-tests/`
(Task 3–4). Helper bersama yang masih dipakai kedua domain **dipindah** ke
`src/shared/assessment.helpers.js` (bukan dihapus) — jika tidak, domain
modules akan rusak.

**Tidak ada** perubahan schema/migration/database, scoring, passingScore,
maxAttempts, mustRepeat, submit, question/answer, progress, certificate, atau
authorization.

## 2. Helper Bersama — Relokasi

- **Dari:** `src/modules/evaluations/evaluation.helpers.js`
- **Ke:** `src/shared/assessment.helpers.js`

Diperlukan karena `pre-tests.service.js` & `post-tests.service.js` masih
mengimpor helper tersebut. Isi logic tidak berubah (hanya path `require`
Prisma disesuaikan `../../config/database` → `../config/database` dan header
komentar). Import di kedua service diubah ke `../../shared/assessment.helpers`.

## 3. Folder/File Legacy yang Dihapus

Seluruh `src/modules/evaluations/`:
- `evaluations.service.js`
- `evaluations.controller.js`
- `evaluations.route.js`
- `evaluation.helpers.js` (dipindah — lihat #2)

Setelah task ini tidak ada lagi folder `src/modules/evaluations/`.

## 4. Route Legacy yang Dihapus

- `src/index.js`: mount `app.use('/api/evaluations', ...)` + import route dihapus.
- `src/modules/modules/modules.route.js`: mount
  `router.use('/:moduleId/evaluations', ...)` + import dihapus.

Route domain tetap aktif: `/:moduleId/pre-tests` dan `/:moduleId/post-tests`.

`/users/:userId/evaluations` di `admin-monitoring.route.js` **BUKAN** legacy
assessment endpoint (resource monitoring user) — **dipertahankan**.

## 5. Test Legacy

- Dihapus: `test/evaluations-delete.test.js` (menguji endpoint/module legacy
  yang sudah dihapus).
- Coverage DELETE domain **tidak hilang** — sudah ada di
  `test/pre-post-tests.test.js`:
  - `PRE DELETE: hapus pre-test berhasil`
  - `PRE DELETE: post_test via pre-tests -> ditolak`
  - `PRE DELETE: tipe legacy module_eval -> ditolak & tidak dihapus` (baru, pindahan)
  - `POST DELETE: hapus post-test berhasil`
  - `POST DELETE: pre_test via post-tests -> ditolak`
  - `CTRL: DELETE pre-test 404 saat tidak ada`
  - `CTRL: DELETE post-test moduleId mismatch -> 400`
  - `AUTHZ: unauthenticated -> 401`, `AUTHZ: role guru ditolak -> 403`
- Script `test:evaldel` dihapus dari `package.json` (menjalankan test legacy
  yang sudah dihapus).

## 6. Reference ke Evaluation yang Masih Tersisa

- `prisma.evaluation` (Prisma model) dipakai langsung oleh:
  `progress.service.js`, `courses.service.js`, `modules.service.js`,
  `admin-monitoring.service.js`. **Sengaja dipertahankan** — database belum
  direfactor (Task 5 melarang mengubahnya).
- Komentar historis di `src/shared/assessment.helpers.js` menyebut path lama
  (bukan import/code reference).
- `/users/:userId/evaluations` di admin-monitoring (resource monitoring).

Tidak ada lagi import/code reference ke module legacy `evaluations/`.

## 7. Domain API Final

- Pre-Test: `/api/modules/:moduleId/pre-tests` (+ `/:preTestId`,
  `/:preTestId/questions`, `/questions/:questionId`, `/:preTestId/submit`,
  `/:preTestId/answers`, `/:preTestId/my-answers`)
- Post-Test: `/api/modules/:moduleId/post-tests` (struktur sama)

## 8. Verifikasi

- Syntax check file domain baru + `index.js` + `modules.route.js` +
  `assessment.helpers.js`: OK.
- `npm run test:prepost`: **27 PASS, 0 FAIL**
- `npm test` (certificates): **18 PASS, 0 FAIL**
- `npm run test:certgen`: **15 PASS, 0 FAIL**
- `npm run test:certpdf`: **5 PASS, 0 FAIL**
- `npx prisma validate`: schema valid (tidak diubah).
- `git diff -- prisma/schema.prisma`: kosong.
- Final search: tidak ada import ke module legacy `evaluations/`.

---

# Handoff — AUDIT: Prisma Evaluation Dependency (Task 6)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.
Sifat: **AUDIT ONLY** — tidak ada perubahan source code / schema / database.

## 1. Ringkasan

Seluruh penggunaan model Prisma `Evaluation` diaudit. Kesimpulan utama:

1. Model `Evaluation` hanya direferensikan oleh **2 model lain**: `Module`
   (one-to-many) dan `Question` (many-to-one). `Option` & `user_answers`
   mencapai Evaluation secara tidak langsung via `Question`.
2. Consumer kode hanya ada **5 file** (+1 helper), semuanya membaca/menulis
   lewat Prisma model langsung. Tidak ada raw SQL.
3. `module_eval` **tidak dipakai** di source code mana pun dan tidak ada di
   seed. Nilainya masih muncul sebagai `@default(module_eval)` pada schema.
4. **Migrations folder sudah drift** terhadap `schema.prisma` — lihat #6
   (temuan penting).
5. `user_progress.preTestSkor` **tidak pernah ditulis** oleh kode mana pun
   (warisan lama), sehingga skor pre-test saat ini hanya tersimpan di
   `user_answers`.

## 2. Model `Evaluation` (schema.prisma)

```prisma
model Evaluation {
  id           String         @id @default(uuid())
  moduleId     String?        @map("module_id") // nullable
  judul        String
  tipe         EvaluationType @default(module_eval)
  passingScore Int            @default(80)
  maxAttempts  Int            @default(3)
  createdAt    DateTime       @default(now())
  module    Module?    @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  questions Question[]
  @@index([moduleId])
  @@index([tipe])
  @@map("evaluations")
}

enum EvaluationType { pre_test, post_test, module_eval }
```

## 3. Tabel Mapping — file/function → dependency → target

| File | Fungsi | Dependency | Data yang dibutuhkan | Target |
|---|---|---|---|---|
| `src/shared/assessment.helpers.js` | `getAssessmentInModule` | `prisma.evaluation.findUnique` by id | id, moduleId, tipe | PreTest/PostTest (per tipe) |
| `src/shared/assessment.helpers.js` | `getAssessmentById` | `prisma.evaluation.findUnique` + `questions.options` | id, judul, tipe, moduleId, passingScore, maxAttempts, questions+options | PreTest/PostTest |
| `src/shared/assessment.helpers.js` | `createAssessment` | `prisma.evaluation.create` | moduleId, judul, tipe, passingScore, maxAttempts | PreTest/PostTest |
| `src/shared/assessment.helpers.js` | `createQuestion` | `prisma.evaluation.findUnique` + `question.create` | evaluationId, options | Question (FK ke assessment) |
| `src/shared/assessment.helpers.js` | `submitJawaban` | `prisma.evaluation.findUnique` (+questions+options), `user_answers.upsert`, `user_progress.upsert` | tipe, passingScore, maxAttempts, moduleId, questions | PreTest/PostTest |
| `src/shared/assessment.helpers.js` | `getAnswersByEvaluation` | `prisma.evaluation.findUnique`, `user_answers.findMany` | evaluationId lewat question | Answer |
| `src/shared/assessment.helpers.js` | `getMyAnswers` | idem (filter userId) | evaluationId lewat question | Answer |
| `src/shared/assessment.helpers.js` | `deleteAssessment` | `prisma.evaluation.delete` (cascade) | id, tipe, moduleId | PreTest/PostTest |
| `src/modules/pre-tests/pre-tests.service.js` | `getPreTestsByModule` | `prisma.evaluation.findMany { moduleId, tipe:'pre_test' }` | id, judul, tipe, passingScore, maxAttempts, _count.questions | PreTest |
| `src/modules/post-tests/post-tests.service.js` | `getPostTestsByModule` | `prisma.evaluation.findMany { moduleId, tipe:'post_test' }` | idem | PostTest |
| `src/modules/progress/progress.service.js` | `hitungStageCompletion` | `prisma.evaluation.findMany` + `user_answers.findMany` | id, moduleId, tipe, passingScore, questions | PreTest + PostTest (dibaca bersama, dipisah per tipe) |
| `src/modules/progress/progress.service.js` | `getProgress` | `module._count.evaluations` | jumlah evaluasi | netral (count) |
| `src/modules/courses/courses.service.js` | `getCourseById`-flow | relasi `module.evaluations` (include:true) | id, tipe, passingScore | PreTest + PostTest |
| `src/modules/modules/modules.service.js` | `getAllModules` | `_count.evaluations` | jumlah | netral (count) |
| `src/modules/modules/modules.service.js` | `getModuleById` | relasi `evaluations` select | id, judul, tipe, createdAt | PreTest + PostTest |
| `src/modules/admin-monitoring/admin-monitoring.service.js` | `getUserEvaluations` | `prisma.evaluation.findMany` (semua) | id, judul, moduleId, module{id,judul,urutan} | PreTest + PostTest (monitoring) |
| `test/pre-post-tests.test.js` | (mock) | in-memory `db.evaluations` | — | test-only, tidak menyentuh DB |

## 4. Audit Relation

| Relasi | Arah | FK | onDelete | Catatan migrasi |
|---|---|---|---|---|
| `Module.evaluations` ↔ `Evaluation.module` | 1-N | `evaluations.module_id` → `modules.id` | Cascade | `module_id` nullable; evaluasi global (moduleId null) mungkin ada |
| `Evaluation` → `Question` | 1-N | `questions.evaluation_id` → `evaluations.id` | Cascade | Berpotensi diganti `pre_test_id`/`post_test_id` |
| `Question` → `Option` | 1-N | `options.question_id` → `questions.id` | Cascade | Tidak terdampak langsung (via question) |
| `Question` → `user_answers` | 1-N | `user_answers.question_id` → `questions.id` | Cascade | Tidak terdampak langsung (via question) |
| `UserProgress` | — | **tidak ada FK ke Evaluation** | — | Agregasi per `moduleId`; aman |
| `user_course_progress` / `Certificate` | — | **tidak ada FK ke Evaluation** | — | Aman |
| `Course` | — | tidak langsung (via Module) | — | Aman |
| monitoring/admin | — | baca langsung `Evaluation` | — | Perlu penyesuaian query jika tabel dipisah |

## 5. Mapping Tipe → Target

- `tipe = pre_test` → **PreTest**
- `tipe = post_test` → **PostTest**
- `tipe = module_eval` → **LEGACY / AMBIGU** (lihat #7). Tidak dipakai kode,
  tidak ada di seed, hanya nilai `@default` di schema. **Butuh keputusan
  manual**: hapus dari enum, map ke salah satu target, atau pertahankan
  sebagai entitas terpisah (kuis modul).

## 6. ⚠️ TEMUAN PENTING — Migration Drift

`prisma/migrations/` **sudah tidak sinkron** dengan `schema.prisma`:

- Init migration (`20260805034112_init_lms_pancawaluya`) membuat tabel
  `evaluations` **tanpa** kolom `tipe`, `passing_score`, `max_attempts`,
  dan dengan `module_id TEXT NOT NULL`.
- **Tidak ada** migration yang menambahkan kolom `tipe`/`passing_score`/
  `max_attempts`, mengubah `module_id` jadi nullable, atau membuat enum
  `EvaluationType`.
- Artinya kolom/enum tersebut diterapkan di luar migration (kemungkinan
  `prisma db push` atau manual).

**Implikasi:** task migrasi schema berikutnya **wajib** lebih dulu
mereconcile drift ini (baseline migration) sebelum memisahkan
PreTest/PostTest, agar `prisma migrate` tidak menghasilkan diff yang salah
atau gagal.

## 7. Ambigu & Butuh Keputusan Manual

1. **`module_eval`** — tidak dipakai kode. Harus ditentukan: dibuang, dipetakan,
   atau jadi model terpisah.
2. **Evaluasi global (`moduleId = null`)** — schema mengizinkan, tapi kode
   selalu mengasumsikan per-modul. Perlu keputusan apakah PreTest/PostTest
   tetap nullable moduleId.
3. **`user_progress.preTestSkor`** — kolom ada tapi tidak pernah ditulis.
   Perlu keputusan: dipakai untuk skor pre-test (mengubah sumber data) atau
   dibiarkan.
4. **Pemisahan tabel vs discriminator** — apakah target benar-benar dua tabel
   (`pre_tests`, `post_tests`) atau tetap satu tabel dengan tipe. Ini
   keputusan desain developer.
5. **`Question`** milik satu assessment — jika tabel dipisah, FK `question`
   harus menunjuk ke dua tabel berbeda (atau polymorphic), yang butuh
   keputusan desain.

## 8. Risiko Data Migration

- **Kehilangan baris `module_eval`** bila tabel dipecah tanpa menangani tipe
  ini (data orphan).
- **Orphan `questions`/`options`/`user_answers`** jika FK/`onDelete` berubah
  salah saat pindah tabel.
- **Evaluasi `moduleId = null`** (global) bisa hilang jika kolom dibuat
  NOT NULL pada tabel baru.
- **`user_progress.skor`** (skor post-test utama) bergantung pada perhitungan
  `passingScore` evaluasi; pemisahan tabel tidak boleh mengubah nilai ini.
- **Skor pre-test** hanya ada di `user_answers` (bukan `preTestSkor`), jadi
  pemindahan harus via `question → evaluation.tipe='pre_test'`.

## 9. Rekomendasi Urutan Migrasi (untuk task TERPISAH, manual oleh developer)

1. **Reconcile migration drift** (baseline) — selaraskan `prisma/migrations`
   dengan `schema.prisma` saat ini (tabel `evaluations` + enum `EvaluationType`)
   tanpa mengubah behavior.
2. **Putuskan takdir `module_eval`** + evaluasi global (`moduleId` null).
3. **Desain target schema** (dua tabel vs discriminator).
4. **Buat migration schema** (tabel `pre_tests`/`post_tests` + FK), TANPA
   drop tabel lama.
5. **Migrasi data** dari `evaluations` (filter by `tipe`), termasuk
   `questions`/`options`/`user_answers` via FK.
6. **Ubah kode** consumer (5 file + helper) ke model baru.
7. **Verifikasi** (test + query) lalu **hapus** tabel/model `Evaluation`
   hanya setelah semua aman.

## 10. Status

- Working tree & perubahan Task 1–5 **utuh**, tidak ada reset/penghapusan.
- Tidak ada perubahan source code, schema, atau database pada Task 6.

---

# Handoff — AUDIT: Reconcile Prisma Migration History (Task 7)

Tanggal: diisi saat commit. Tidak ada secret pada dokumen ini.
Sifat: **AUDIT ONLY** — tidak ada perubahan source code / schema / database.
Tidak menjalankan migration / `db push` / `reset`.

## 1. Kondisi Migration History Saat Ini

`prisma/migrations/` — 5 migration:

| # | Migration | Isi | Menyentuh assessment? |
|---|---|---|---|
| 1 | `20260805034112_init_lms_pancawaluya` | CREATE enum + tabel users, modules, contents, **evaluations**, **questions**, **options**, **user_progress**, **user_answers** + FK | Ya (skema awal) |
| 2 | `20260807014812_add_unique_user_answers` | UNIQUE index `(user_id, question_id)` di `user_answers` | Ya (answer) |
| 3 | `20260916122547_add_user_content_progress` | CREATE `user_content_progress` + FK | Tidak |
| 4 | `20260916140658_add_certificate` | CREATE `certificates` + FK | Tidak |
| 5 | `20260916150147_add_course_certificate_template` | ADD 3 kolom ke `courses` | Tidak |

**Init migration membuat `evaluations` HANYA dengan kolom:**
`id`, `module_id` (**NOT NULL**), `judul`, `created_at`.

## 2. Daftar Drift (migration history vs schema)

### 2a. Drift yang sudah ada SEBELUM Task 6 (schema lama = HEAD commit)

| Entitas | Migration menghasilkan | Schema HEAD (tesoretis) | Status |
|---|---|---|---|
| enum `EvaluationType` | **tidak ada** | ada (`pre_test`,`post_test`,`module_eval`) | DRIFT |
| `evaluations.tipe` | **tidak ada** | ada, default `module_eval` | DRIFT |
| `evaluations.passing_score` | **tidak ada** | ada, default 80 | DRIFT |
| `evaluations.max_attempts` | **tidak ada** | ada, default 3 | DRIFT |
| `evaluations.module_id` | **NOT NULL** | **nullable** | DRIFT |
| `modules.course_id` | **tidak ada** | ada (nullable) | DRIFT |
| `courses` table | **tidak ada** (tapi direferensikan migration #5) | ada | DRIFT |
| enum `CourseMode` | tidak ada | ada | DRIFT |
| `User` (kolom baru: status, nip, school_id, dll.) | sebagian | lengkap | DRIFT |
| MiniQuiz, Ticket, Feedback, Comment, RtlSubmission, Notification, MasterSekolah, MasterGuru | **tidak ada** | ada | DRIFT |

**Kesimpulan:** migration history sudah lama tidak sinkron. Schema telah
berkembang lewat `prisma db push` (atau setara) selama beberapa commit.
Tabel/model di luar 8 tabel init tidak pernah punya migration.

### 2b. Drift BARU dari perubahan schema yang belum di-commit (working tree)

Developer **sudah mengubah `prisma/schema.prisma`** (uncommitted) untuk target
PreTest/PostTest:

| Perubahan | Dari (HEAD) | Ke (working schema) |
|---|---|---|
| Model assessment | `Evaluation` (1 tabel + `tipe`) | `PreTest` (`pre_tests`) + `PostTest` (`post_tests`) |
| enum `EvaluationType` | ada | **dihapus** |
| `Module.evaluations` | `Evaluation[]` | `preTests PreTest[]` + `postTests PostTest[]` |
| `Question` FK | `evaluationId` (1 FK, NOT NULL) | `preTestId` + `postTestId` (2 FK, **nullable**) |
| `user_progress`, `user_answers` | — | struktur sama (hanya komentar) |

**Catatan penting:** working `schema.prisma` **valid** (`prisma validate` OK),
tetapi **source code masih memakai `prisma.evaluation`** (belum dimigrasikan).
Jadi saat ini ada 3 lapisan yang tidak sinkron:
1. migrations (paling lama),
2. schema committed (HEAD),
3. schema working (target PreTest/PostTest),
4. kode (masih pakai `Evaluation`).

## 3. Target Migration Sequence

Rekomendasi urutan (untuk task TERPISAH, dieksekusi manual developer):

1. **Baseline / reconcile drift lama** — buat kondisi migration = schema
   committed (HEAD) saat ini. Opsi:
   - (a) `prisma migrate diff` dari migrations → HEAD schema, atau
   - (b) tandai migration history sebagai baselined (`prisma migrate resolve`)
     lalu buat satu migration "catch-up" berisi seluruh tabel existing.
   **WAJIB diselesaikan dulu** agar migrasi PreTest/PostTest menghasilkan diff
   yang benar. (Task ini tidak mengeksekusi apa pun.)

2. **Migration schema #1 — buat tabel baru** (aditif, TANPA drop):
   - `CREATE TABLE "pre_tests"` (id, module_id NOT NULL, judul,
     passing_score default 0, max_attempts default 1, created_at) + FK module.
   - `CREATE TABLE "post_tests"` (id, module_id NOT NULL, judul,
     passing_score default 80, max_attempts default 3, created_at) + FK module.

3. **Migration schema #2 — tambah FK Question** (aditif, nullable):
   - `ALTER TABLE "questions" ADD COLUMN "pre_test_id" TEXT NULL`
   - `ALTER TABLE "questions" ADD COLUMN "post_test_id" TEXT NULL`
   - FK ke `pre_tests`/`post_tests` dengan ON DELETE CASCADE.
   - Index pada kedua kolom.

4. **Migration data #3 — pindahkan data** (DML, lihat #4).

5. **Migration schema #4 — lepaskan kolom lama** (setelah verifikasi):
   - drop FK `questions_evaluation_id_fkey`, drop kolom `evaluation_id`.
   - drop tabel `evaluations` + enum `EvaluationType`.
   - `questions.evaluation_id` saat init NOT NULL → butuh perhatian.

6. **Migrasi kode** consumer (helper + 5 file) ke `prisma.preTest`/`postTest`.

7. **Verifikasi** end-to-end, lalu tandai selesai.

## 4. Rencana Data Migration (REKOMENDASI — jangan eksekusi)

### 4a. Pre-Test → `pre_tests`
```sql
INSERT INTO "pre_tests" ("id","module_id","judul","passing_score","max_attempts","created_at")
SELECT "id","module_id","judul",0,1,"created_at"
FROM "evaluations"
WHERE "tipe" = 'pre_test';
```

### 4b. Post-Test → `post_tests`
```sql
INSERT INTO "post_tests" ("id","module_id","judul","passing_score","max_attempts","created_at")
SELECT "id","module_id","judul","passing_score","max_attempts","created_at"
FROM "evaluations"
WHERE "tipe" = 'post_test';
```
> `id` dipertahankan sama agar referensi Question/Answer stabil (atau di-remap
> konsisten bila id baru dibuat — lihat 4e).

### 4c. Question → FK baru
```sql
-- Question milik pre_test
UPDATE "questions" q
SET "pre_test_id" = q."evaluation_id"
FROM "evaluations" e
WHERE q."evaluation_id" = e."id" AND e."tipe" = 'pre_test';

-- Question milik post_test
UPDATE "questions" q
SET "post_test_id" = q."evaluation_id"
FROM "evaluations" e
WHERE q."evaluation_id" = e."id" AND e."tipe" = 'post_test';
```
`Option` dan `user_answers` **tidak perlu diubah** — mereka terhubung ke
`Question` via `question_id` (tidak berubah).

### 4d. `module_eval` (legacy)
Tidak ada di kode/seed, tetapi **bisa ada di DB existing**. Perlu keputusan
manual:
- **Opsi A:** pertahankan sebagai entitas baru (mis. tabel `module_evaluations`).
- **Opsi B:** petakan ke `post_test` (berisiko salah domain).
- **Opsi C:** hapus bila dikonfirmasi tidak ada data.
**JANGAN** diputuskan otomatis — butuh keputusan developer + cek `count(*) WHERE tipe='module_eval'`.

### 4e. Evaluasi global (`module_id IS NULL`)
Schema lama mengizinkan `module_id` null (evaluasi global). Schema baru
`PreTest`/`PostTest` **module_id NOT NULL**. Baris `module_id IS NULL` akan
gagal/terbuang saat migrasi — butuh keputusan (buang / buat module khusus /
buat nullable).

## 5. Risiko Kehilangan / Orphan Data

1. **`module_eval` orphan** — baris ini tidak punya tujuan jika hanya dua
   tabel dibuat. Wajib ditangani sebelum drop `evaluations`.
2. **Evaluasi global (`module_id IS NULL`)** — hilang bila PreTest/PostTest
   NOT NULL. Data + question/answer-nya bisa ikut hilang (cascade).
3. **`questions.evaluation_id` NOT NULL** (di migration init) — saat menambah
   `pre_test_id`/`post_test_id` nullable, semua baris lama punya FK null
   sampai di-update. Jika drop `evaluation_id` terlalu cepat → orphan.
4. **Cascade saat drop `evaluations`** — FK `questions_evaluation_id_fkey`
   `ON DELETE CASCADE`. Drop tabel/kolom bisa memicu cascade yang
   menghapus questions/options/user_answers bila tidak urut. **Urutan drop
   wajib: update FK baru → verifikasi → baru drop.**
5. **Question tanpa FK** — schema baru mengizinkan `pre_test_id` DAN
   `post_test_id` dua-duanya null (tidak ada DB constraint "salah satu wajib
   diisi"). Perlu validasi aplikasi atau CHECK constraint.
6. **`user_progress.skor`/`preTestSkor`** — tidak terpengaruh langsung, tapi
   nilai `skor` post-test harus tetap konsisten setelah pemisahan.

## 6. Ambigu / Butuh Keputusan Manual

1. Takdir `module_eval` (opsi 4d).
2. Takdir evaluasi global `module_id IS NULL` (opsi 4e).
3. Strategi reconcile drift lama: baseline via `migrate diff` vs
   `migrate resolve` + catch-up.
4. Apakah `id` assessment dipertahankan (ansjuran: ya) atau di-regenerate.
5. Constraint "Question harus milik tepat satu assessment" (CHECK vs aplikasi).
6. Nama relasi Prisma `"PreTestQuestions"`/`"PostTestQuestions"` sudah dipakai;
   pastikan tipe migrasi SQL selaras.

## 7. Status

- **Tidak ada perubahan** source code / schema / database / migration.
- Working tree & perubahan Task 1–6 **utuh** (tidak di-reset/dihapus).
- Catatan: `prisma/schema.prisma` sudah berisi draft target (PreTest/PostTest)
  sebagai perubahan **uncommitted milik developer**; Task 7 hanya mengaudit,
  tidak menyentuhnya.
