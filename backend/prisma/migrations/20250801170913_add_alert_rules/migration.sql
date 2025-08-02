-- CreateTable
CREATE TABLE "early_warning_alerts" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'binance',
    "alertType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeEstimateMin" INTEGER NOT NULL,
    "timeEstimateMax" INTEGER NOT NULL,
    "volumeSpike" JSONB,
    "rsiMomentum" JSONB,
    "emaConvergence" JSONB,
    "bidAskImbalance" JSONB,
    "priceAction" JSONB,
    "whaleActivity" JSONB,
    "phase1Score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phase2Score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phase3Score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "triggeredBy" JSONB NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION,
    "priceChange24h" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "actualOutcome" TEXT,
    "accuracyScore" DOUBLE PRECISION,
    "responseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_warning_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "symbol" TEXT,
    "timeframe" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "confidenceMin" DOUBLE PRECISION,
    "strengthMin" DOUBLE PRECISION,
    "priceChangeMin" DOUBLE PRECISION,
    "priceChangeMax" DOUBLE PRECISION,
    "volumeChangeMin" DOUBLE PRECISION,
    "alertType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "early_warning_alerts_symbol_alertType_createdAt_idx" ON "early_warning_alerts"("symbol", "alertType", "createdAt");

-- CreateIndex
CREATE INDEX "early_warning_alerts_confidence_createdAt_idx" ON "early_warning_alerts"("confidence", "createdAt");

-- CreateIndex
CREATE INDEX "early_warning_alerts_isActive_isResolved_createdAt_idx" ON "early_warning_alerts"("isActive", "isResolved", "createdAt");

-- CreateIndex
CREATE INDEX "early_warning_alerts_actualOutcome_accuracyScore_idx" ON "early_warning_alerts"("actualOutcome", "accuracyScore");

-- CreateIndex
CREATE INDEX "alert_rules_symbol_timeframe_isActive_idx" ON "alert_rules"("symbol", "timeframe", "isActive");

-- CreateIndex
CREATE INDEX "alert_rules_indicator_condition_isActive_idx" ON "alert_rules"("indicator", "condition", "isActive");

-- CreateIndex
CREATE INDEX "alert_rules_lastTriggered_cooldownMinutes_idx" ON "alert_rules"("lastTriggered", "cooldownMinutes");
