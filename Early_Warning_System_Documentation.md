# Early Warning System - Complete Documentation

## Overview
The Early Warning System is a sophisticated cryptocurrency analysis tool that predicts potential PUMP_LIKELY and DUMP_LIKELY events using a 3-phase confidence scoring system. It analyzes market data in real-time and alerts users when specific conditions are met based on configurable rules.

## System Architecture

### 1. Admin Panel Configuration
**Location**: Admin Panel → Early Warning Alert Rules

**Rule Configuration Fields**:
- **Rule Name**: Descriptive name for the alert rule
- **Minimum Confidence**: Threshold percentage (0-100%) that must be exceeded
- **Alert Types**: PUMP_LIKELY, DUMP_LIKELY, or both
- **Priority**: HIGH, MEDIUM, LOW (affects notification display)

**Rule Management**:
- Create multiple rules with different thresholds
- Rules are stored in PostgreSQL database
- Active rules are checked every 30 seconds against all tracked coins
- No cooldown logic - rules remain active until manually deleted

### 2. Real-Time Analysis Engine

**Analysis Frequency**: Every 30 seconds for all 30 tracked coins
**Data Source**: Binance WebSocket streams (no REST API calls to avoid rate limits)
**Processing**: 3-phase sequential analysis for each coin

## Three-Phase Analysis System

### Phase 1: Volume & Momentum Detection (Max 30 Points)

**Purpose**: Detect unusual volume spikes and momentum shifts

**Components**:

1. **Volume Spike Detection (20 points)**
   - Calculates Z-score using 20-period rolling average
   - Threshold: >2.5 standard deviations = spike detected
   - Points awarded: min(Z-score * 4, 20)

2. **RSI Momentum Analysis (10 points)**
   - Uses 1-minute timeframe RSI from technical indicators
   - Extreme conditions: RSI < 30 (oversold) or RSI > 70 (overbought)
   - Points awarded: 10 if extreme conditions met

**Calculation Logic**:
```
volumeHistory = last 20 volume readings
avgVolume = mean(volumeHistory)
stdDev = standardDeviation(volumeHistory)
zScore = (currentVolume - avgVolume) / stdDev
if zScore > 2.5: volumeSpike = true, points = min(zScore * 4, 20)
```

### Phase 2: Order Flow Analysis (Max 30 Points)

**Purpose**: Analyze market microstructure and order flow patterns

**Components**:

1. **Bid-Ask Spread Analysis (10 points)**
   - Monitors spread widening as indicator of volatility
   - Threshold: >0.1% spread = 10 points

2. **Order Book Pressure (10 points)**
   - Analyzes bid/ask volume imbalance
   - Ratio calculation: bidVolume / askVolume
   - Bullish: ratio > 1.5 = 10 points
   - Bearish: ratio < 0.67 = 10 points

3. **Price Momentum (10 points)**
   - Short-term price velocity analysis
   - Threshold: >1% price change in analysis window = 10 points

**Calculation Logic**:
```
spread = (askPrice - bidPrice) / midPrice * 100
if spread > 0.1: spreadPoints = 10

bidVolume = sum(top 10 bid levels)
askVolume = sum(top 10 ask levels)
ratio = bidVolume / askVolume
if ratio > 1.5 or ratio < 0.67: pressurePoints = 10
```

### Phase 3: Whale Activity Detection (Max 40 Points)

**Purpose**: Detect large institutional or whale movements using Binance WebSocket data

**Components**:

1. **Large Order Detection (12 points)**
   - Scans order book for orders >$50,000 USD
   - Points: (number of large orders) * 2, max 12

2. **Large Trade Detection (10 points)**
   - Monitors trades >$25,000 USD in last hour
   - Points: (number of large trades) * 2, max 10

3. **Volume Spike Analysis (8 points)**
   - Detects 2.5x+ volume spikes vs historical average
   - Points: min(spikeRatio * 2, 8)

4. **Order Book Imbalance (6 points)**
   - Large bid/ask walls >$100,000
   - Points: (wall count) * 1.5, max 6

5. **Price Impact Detection (4 points)**
   - Significant price movements >0.5%
   - Points: min(impact * 2, 4)

**Whale Detection Scoring**:
```
score = 0
score += min((largeBids.length + largeAsks.length) * 2, 12)
score += min(largeTrades.length * 2, 10)
if volumeSpike.detected: score += min(spikeRatio * 2, 8)
if orderBookImbalance != 'NEUTRAL': score += min(wallCount * 1.5, 6)
if priceImpact.detected: score += min(impact * 2, 4)
```

**Transfer Direction Classification**:
- **ACCUMULATION**: Bullish signals (large buying, price up)
- **DISTRIBUTION**: Bearish signals (large selling, price down)
- **LARGE_TRANSFER**: Significant volume without clear direction
- **UNKNOWN**: Insufficient data for classification

## Overall Confidence Calculation

**Total Score**: Sum of all three phases (max 100 points)
```
totalConfidence = phase1Score + phase2Score + phase3Score
finalConfidence = min(totalConfidence, 100)
```

**Alert Type Determination**:
- **PUMP_LIKELY**: Bullish signals dominate (volume up + price momentum + accumulation)
- **DUMP_LIKELY**: Bearish signals dominate (volume up + price drop + distribution)
- **NEUTRAL**: Mixed or insufficient signals

## Rule Checking & Alert Generation

### 1. Rule Evaluation Process
**Frequency**: Every 30 seconds via cron job
**Scope**: All 30 tracked coins checked against all active rules

**Matching Logic**:
```
for each coin:
    analysis = performThreePhaseAnalysis(coin)
    for each activeRule:
        if analysis.confidence >= rule.minimumConfidence:
            if rule.alertTypes.includes(analysis.alertType):
                saveAlert(analysis, rule)
                broadcastToast(analysis, rule)
```

### 2. Alert Storage & Broadcasting
**Database**: PostgreSQL with Prisma ORM
- `EarlyWarningAlert` table: Stores all generated alerts
- `EarlyWarningAlertHistory` table: Historical alert data

**Real-time Notifications**:
- WebSocket broadcast to coin listing page
- Toast notifications with 30-second display duration
- Alert details include: coin, confidence, phase scores, rule triggered

### 3. Alert Display System
**Coin Listing Page**:
- Toast notifications appear when rules match
- Shows confidence percentage, alert type, and triggering rule
- Clickable coin names navigate to detailed analysis

**Early Warning System Panel**:
- Recent alerts (last 24 hours)
- All alerts (complete history)
- Phase score breakdown with color coding:
  - Volume & Momentum: Blue
  - Order Flow: Purple  
  - Whale Activity: Orange

## Data Sources & Performance

### WebSocket Integration
- **No REST API calls**: Prevents rate limiting
- **Shared BinanceService**: Uses existing WebSocket connections
- **Real-time updates**: Ticker, order book, and kline data
- **Cached data**: Efficient access to market data

### Performance Optimizations
- **Combined streams**: Single WebSocket for multiple symbols
- **Efficient caching**: In-memory storage for historical data
- **Batch processing**: 30-second analysis intervals
- **Minimal database writes**: Only rule-matched alerts saved

## Technical Implementation

### Key Services
1. **EarlyWarningService**: Core analysis engine
2. **BinanceWhaleDetectionService**: Phase 3 whale detection
3. **AdvancedTechnicalAnalysis**: Technical indicator calculations
4. **BinanceService**: WebSocket data management

### Data Flow
```
WebSocket Data → BinanceService Cache → EarlyWarningService Analysis → 
Rule Checking → Database Storage → WebSocket Broadcast → UI Display
```

### Error Handling
- Graceful fallbacks for missing data
- Comprehensive logging for debugging
- Automatic retry mechanisms for failed analyses
- Empty result structures for error cases

## Configuration & Monitoring

### Environment Variables
- Database connection strings
- WebSocket endpoints
- Analysis thresholds
- Logging levels

### Monitoring & Logs
- Real-time analysis logs with timestamps
- Phase score breakdowns for debugging
- Error tracking and stack traces
- Performance metrics and timing data

This system provides comprehensive early warning capabilities for cryptocurrency trading by combining volume analysis, order flow monitoring, and whale detection into a unified confidence scoring system that can be customized through flexible rule configuration.
