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


