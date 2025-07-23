-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "settingValue" TEXT NOT NULL,
    "settingType" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" DOUBLE PRECISION,
    "minStrength" DOUBLE PRECISION,
    "requiredTimeframes" INTEGER,
    "requiredSignalType" TEXT,
    "advancedConditions" JSONB,
    "enableSound" BOOLEAN NOT NULL DEFAULT true,
    "enableVisual" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_history" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'binance',
    "timeframe" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "technicalIndicators" JSONB,
    "chartPatterns" JSONB,
    "candlestickPatterns" JSONB,
    "reasoning" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingTimeMs" INTEGER,

    CONSTRAINT "signal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "symbol" TEXT,
    "signal" TEXT,
    "confidence" DOUBLE PRECISION,
    "strength" DOUBLE PRECISION,
    "timeframe" TEXT,
    "hasVisual" BOOLEAN NOT NULL DEFAULT true,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "ruleId" TEXT,
    "signalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_settingKey_key" ON "admin_settings"("settingKey");

-- CreateIndex
CREATE INDEX "signal_history_symbol_timeframe_generatedAt_idx" ON "signal_history"("symbol", "timeframe", "generatedAt");

-- CreateIndex
CREATE INDEX "signal_history_signal_confidence_generatedAt_idx" ON "signal_history"("signal", "confidence", "generatedAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_isRead_idx" ON "notifications"("createdAt", "isRead");

-- CreateIndex
CREATE INDEX "notifications_type_priority_createdAt_idx" ON "notifications"("type", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_symbol_signal_createdAt_idx" ON "notifications"("symbol", "signal", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signal_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;
