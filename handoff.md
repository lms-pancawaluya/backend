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
