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

