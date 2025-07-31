-- Crypto Assistant Database Schema
-- PostgreSQL Schema for AApanel Database
-- Run this script in pgAdmin to create all required tables

-- Create admin_settings table
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

-- Create notification_rules table
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" DOUBLE PRECISION,
    "minStrength" DOUBLE PRECISION,
    "requiredTimeframes" INTEGER,
    "specificTimeframes" JSONB,
    "requiredSignalType" TEXT,
    "advancedConditions" JSONB,
    "enableSound" BOOLEAN NOT NULL DEFAULT true,
    "enableVisual" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- Create signal_history table
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

-- Create notifications table
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
    "technicalIndicators" JSONB,
    "chartPatterns" JSONB,
    "candlestickPatterns" JSONB,
    "triggeredTimeframes" JSONB,
    "analysisReasoning" JSONB,
    "currentPrice" DOUBLE PRECISION,
    "exchange" TEXT,
    "hasVisual" BOOLEAN NOT NULL DEFAULT true,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "ruleId" TEXT,
    "signalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "admin_settings_settingKey_key" ON "admin_settings"("settingKey");

-- Create performance indexes
CREATE INDEX "signal_history_symbol_timeframe_generatedAt_idx" ON "signal_history"("symbol", "timeframe", "generatedAt");
CREATE INDEX "signal_history_signal_confidence_generatedAt_idx" ON "signal_history"("signal", "confidence", "generatedAt");
CREATE INDEX "notifications_createdAt_isRead_idx" ON "notifications"("createdAt", "isRead");
CREATE INDEX "notifications_type_priority_createdAt_idx" ON "notifications"("type", "priority", "createdAt");
CREATE INDEX "notifications_symbol_signal_createdAt_idx" ON "notifications"("symbol", "signal", "createdAt");

-- Add foreign key constraints
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ruleId_fkey" 
    FOREIGN KEY ("ruleId") REFERENCES "notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_signalId_fkey" 
    FOREIGN KEY ("signalId") REFERENCES "signal_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default admin settings (optional)
INSERT INTO "admin_settings" ("id", "settingKey", "settingValue", "settingType", "description", "category", "createdAt", "updatedAt") VALUES
('default_confidence_threshold', 'confidence_threshold', '70', 'number', 'Default confidence threshold for signals', 'confidence', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('default_strength_threshold', 'strength_threshold', '60', 'number', 'Default strength threshold for signals', 'strength', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('default_timeframes', 'active_timeframes', '["1m","15m","30m","4h"]', 'json', 'Active timeframes for analysis', 'timeframe', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('notification_enabled', 'notifications_enabled', 'true', 'boolean', 'Enable/disable notifications globally', 'notification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Schema creation completed successfully
-- You can now connect your application using:
-- DATABASE_URL="postgresql://CryptoAssistant:IvLfcLJ5MCCLnZ@YOUR_SERVER_IP:5432/CryptoAssistant"
