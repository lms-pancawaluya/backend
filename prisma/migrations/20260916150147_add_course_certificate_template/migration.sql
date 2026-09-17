-- AlterTable
-- Additive migration untuk fitur Certificate Template (LMS Pancawaluya).
-- Hanya menambah 3 kolom nullable pada tabel "courses".
-- Tidak ada DROP / TRUNCATE / DELETE. Tidak menyentuh tabel existing.
ALTER TABLE "courses"
    ADD COLUMN "certificate_template_url" TEXT,
    ADD COLUMN "certificate_template_id" TEXT,
    ADD COLUMN "certificate_overlay" JSONB;
