-- CreateTable
CREATE TABLE "alert_history" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceChange24h" DOUBLE PRECISION NOT NULL,
    "triggeringIndicators" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_history_symbol_triggeredAt_idx" ON "alert_history"("symbol", "triggeredAt");

-- CreateIndex
CREATE INDEX "alert_history_ruleId_triggeredAt_idx" ON "alert_history"("ruleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "alert_history_signal_confidence_triggeredAt_idx" ON "alert_history"("signal", "confidence", "triggeredAt");
