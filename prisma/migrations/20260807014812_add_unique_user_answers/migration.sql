/*
  Warnings:

  - A unique constraint covering the columns `[user_id,question_id]` on the table `user_answers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_answers_user_id_question_id_key" ON "user_answers"("user_id", "question_id");
