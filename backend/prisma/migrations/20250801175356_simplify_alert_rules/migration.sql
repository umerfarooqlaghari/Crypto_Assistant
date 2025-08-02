/*
  Warnings:

  - You are about to drop the column `alertType` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `indicator` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `priceChangeMax` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `priceChangeMin` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `strengthMin` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `threshold` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `timeframe` on the `alert_rules` table. All the data in the column will be lost.
  - You are about to drop the column `volumeChangeMin` on the `alert_rules` table. All the data in the column will be lost.
  - Added the required column `signalTypes` to the `alert_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeframes` to the `alert_rules` table without a default value. This is not possible if the table is not empty.
  - Made the column `confidenceMin` on table `alert_rules` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "alert_rules_indicator_condition_isActive_idx";

-- DropIndex
DROP INDEX "alert_rules_symbol_timeframe_isActive_idx";

-- AlterTable
ALTER TABLE "alert_rules" DROP COLUMN "alertType",
DROP COLUMN "condition",
DROP COLUMN "indicator",
DROP COLUMN "priceChangeMax",
DROP COLUMN "priceChangeMin",
DROP COLUMN "strengthMin",
DROP COLUMN "threshold",
DROP COLUMN "timeframe",
DROP COLUMN "volumeChangeMin",
ADD COLUMN     "signalTypes" TEXT NOT NULL,
ADD COLUMN     "timeframes" TEXT NOT NULL,
ALTER COLUMN "confidenceMin" SET NOT NULL;

-- CreateIndex
CREATE INDEX "alert_rules_symbol_isActive_idx" ON "alert_rules"("symbol", "isActive");

-- CreateIndex
CREATE INDEX "alert_rules_confidenceMin_isActive_idx" ON "alert_rules"("confidenceMin", "isActive");
