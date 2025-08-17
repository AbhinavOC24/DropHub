/*
  Warnings:

  - A unique constraint covering the columns `[storeId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Subscription_storeId_key" ON "public"."Subscription"("storeId");
