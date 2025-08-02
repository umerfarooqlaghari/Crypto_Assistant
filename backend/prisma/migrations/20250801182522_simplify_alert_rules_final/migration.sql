/*
  Warnings:

  - You are about to drop the column `cooldownMinutes` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `signalTypes` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `symbol` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `timeframes` on the `alert_rules` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "alert_rules_lastTriggered_cooldownMinutes_idx";

-- DropIndex
DROP INDEX "alert_rules_symbol_isActive_idx";

-- AlterTable
ALTER TABLE "alert_rules" DROP COLUMN "cooldownMinutes",
DROP COLUMN "signalTypes",
DROP COLUMN "symbol",
DROP COLUMN "timeframes",
ADD COLUMN     "specificTimeframes" TEXT;

-- CreateIndex
CREATE INDEX "alert_rules_isActive_idx" ON "alert_rules"("isActive");
