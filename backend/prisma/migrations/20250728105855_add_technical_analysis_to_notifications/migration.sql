-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "analysisReasoning" JSONB,
ADD COLUMN     "candlestickPatterns" JSONB,
ADD COLUMN     "chartPatterns" JSONB,
ADD COLUMN     "currentPrice" DOUBLE PRECISION,
ADD COLUMN     "exchange" TEXT,
ADD COLUMN     "technicalIndicators" JSONB,
ADD COLUMN     "triggeredTimeframes" JSONB;
