-- CreateTable
CREATE TABLE "user_content_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_content_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_content_progress_user_id_idx" ON "user_content_progress"("user_id");

-- CreateIndex
CREATE INDEX "user_content_progress_content_id_idx" ON "user_content_progress"("content_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_content_progress_user_id_content_id_key" ON "user_content_progress"("user_id", "content_id");

-- AddForeignKey
ALTER TABLE "user_content_progress" ADD CONSTRAINT "user_content_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_content_progress" ADD CONSTRAINT "user_content_progress_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
