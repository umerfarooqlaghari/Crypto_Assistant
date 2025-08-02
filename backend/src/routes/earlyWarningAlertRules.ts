import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

const router = Router();
const prisma = new PrismaClient();

// Global WebSocket instance for broadcasting
let io: SocketIOServer | null = null;
let realTimeService: any = null;

// Function to set the WebSocket instance and real-time service
export const setSocketIO = (socketIO: SocketIOServer) => {
  io = socketIO;
};

// Function to set the real-time service for accessing early warning service
export const setRealTimeService = (service: any) => {
  realTimeService = service;
};

// Valid alert types
const validAlertTypes = ['PUMP_LIKELY', 'DUMP_LIKELY'];

// Valid priorities
const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];

// Valid phases (for future use)
// const validPhases = ['phase1', 'phase2', 'phase3'];

// Valid trigger types (for future use)
// const validTriggers = ['Volume Spike', 'RSI Momentum', 'EMA Convergence', 'Whale Activity', 'Bid/Ask Imbalance', 'Price Action'];

// Get all early warning alert rules
router.get('/', async (_req, res) => {
  try {
    const rules = await prisma.earlyWarningAlertRule.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const parsedRules = rules.map((rule: any) => ({
      ...rule,
      alertTypes: Array.isArray(rule.alertTypes) ? rule.alertTypes : JSON.parse(rule.alertTypes as string)
    }));

    return res.json({
      success: true,
      data: parsedRules
    });
  } catch (error) {
    logError('Error fetching early warning alert rules', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch early warning alert rules'
    });
  }
});

// Get active early warning alert rules only
router.get('/active', async (_req, res) => {
  try {
    const rules = await prisma.earlyWarningAlertRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const parsedRules = rules.map((rule: any) => ({
      ...rule,
      alertTypes: Array.isArray(rule.alertTypes) ? rule.alertTypes : JSON.parse(rule.alertTypes as string)
    }));

    return res.json({
      success: true,
      data: parsedRules
    });
  } catch (error) {
    logError('Error fetching active early warning alert rules', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active early warning alert rules'
    });
  }
});

// Create new early warning alert rule
router.post('/', async (req, res) => {
  try {
    const {
      name,
      minConfidence,
      alertTypes,
      priority
    } = req.body;

    // Validate required fields
    if (!name || minConfidence === undefined || !alertTypes || !Array.isArray(alertTypes)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, minConfidence, alertTypes'
      });
    }

    // Validate alert types
    for (const alertType of alertTypes) {
      if (!validAlertTypes.includes(alertType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid alert type: ${alertType}. Must be one of: ${validAlertTypes.join(', ')}`
        });
      }
    }

    // Validate confidence range
    const confidence = parseFloat(minConfidence.toString());
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
      return res.status(400).json({
        success: false,
        error: 'Confidence must be a valid number between 0 and 100'
      });
    }



    // Validate priority
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }



    const rule = await prisma.earlyWarningAlertRule.create({
      data: {
        name,
        minConfidence: confidence,
        alertTypes: JSON.stringify(alertTypes),
        priority: priority || 'MEDIUM'
      }
    });

    const parsedRule = {
      ...rule,
      alertTypes: JSON.parse(rule.alertTypes as string)
    };

    logInfo(`Early warning alert rule created: ${name}`);

    return res.status(201).json({
      success: true,
      data: parsedRule
    });
  } catch (error) {
    logError('Error creating early warning alert rule', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create early warning alert rule'
    });
  }
});

// Update early warning alert rule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      minConfidence,
      alertTypes,
      requiredPhases,
      minPhaseScore,
      minTimeEstimate,
      maxTimeEstimate,
      requiredTriggers,
      priority,
      enableToast,
      enableSound
    } = req.body;

    // Validate required fields
    if (!name || minConfidence === undefined || !alertTypes || !Array.isArray(alertTypes)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, minConfidence, alertTypes'
      });
    }

    // Validate alert types
    for (const alertType of alertTypes) {
      if (!validAlertTypes.includes(alertType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid alert type: ${alertType}. Must be one of: ${validAlertTypes.join(', ')}`
        });
      }
    }

    // Validate confidence range
    const confidence = parseFloat(minConfidence.toString());
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
      return res.status(400).json({
        success: false,
        error: 'Confidence must be a valid number between 0 and 100'
      });
    }

    // Similar validation as in POST route...
    // (Validation code omitted for brevity - same as above)

    const rule = await prisma.earlyWarningAlertRule.update({
      where: { id },
      data: {
        name,
        description,
        minConfidence: confidence,
        alertTypes: JSON.stringify(alertTypes),
        requiredPhases: requiredPhases && requiredPhases.length > 0 ? JSON.stringify(requiredPhases) : undefined,
        minPhaseScore: minPhaseScore ? parseFloat(minPhaseScore.toString()) : undefined,
        minTimeEstimate: minTimeEstimate ? parseInt(minTimeEstimate.toString()) : undefined,
        maxTimeEstimate: maxTimeEstimate ? parseInt(maxTimeEstimate.toString()) : undefined,
        requiredTriggers: requiredTriggers && requiredTriggers.length > 0 ? JSON.stringify(requiredTriggers) : undefined,
        priority: priority || 'MEDIUM',
        enableToast: enableToast !== undefined ? enableToast : true,
        enableSound: enableSound !== undefined ? enableSound : true
      }
    });

    const parsedRule = {
      ...rule,
      alertTypes: JSON.parse(rule.alertTypes as string),
      requiredPhases: rule.requiredPhases ? JSON.parse(rule.requiredPhases as string) : null,
      requiredTriggers: rule.requiredTriggers ? JSON.parse(rule.requiredTriggers as string) : null
    };

    logInfo(`Early warning alert rule updated: ${id}`);

    return res.json({
      success: true,
      data: parsedRule
    });
  } catch (error) {
    logError('Error updating early warning alert rule', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update early warning alert rule'
    });
  }
});

// Get early warning alert rule by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await prisma.earlyWarningAlertRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Early warning alert rule not found'
      });
    }

    const parsedRule = {
      ...rule,
      alertTypes: Array.isArray(rule.alertTypes) ? rule.alertTypes : JSON.parse(rule.alertTypes as string),
      requiredPhases: rule.requiredPhases ? (Array.isArray(rule.requiredPhases) ? rule.requiredPhases : JSON.parse(rule.requiredPhases as string)) : null,
      requiredTriggers: rule.requiredTriggers ? (Array.isArray(rule.requiredTriggers) ? rule.requiredTriggers : JSON.parse(rule.requiredTriggers as string)) : null
    };

    return res.json({
      success: true,
      data: parsedRule
    });
  } catch (error) {
    logError('Error fetching early warning alert rule', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch early warning alert rule'
    });
  }
});

// Delete early warning alert rule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.earlyWarningAlertRule.delete({
      where: { id }
    });

    logInfo(`Early warning alert rule deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Early warning alert rule deleted successfully'
    });
  } catch (error) {
    logError('Error deleting early warning alert rule', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete early warning alert rule'
    });
  }
});

// Toggle early warning alert rule active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const currentRule = await prisma.earlyWarningAlertRule.findUnique({
      where: { id }
    });

    if (!currentRule) {
      return res.status(404).json({
        success: false,
        error: 'Early warning alert rule not found'
      });
    }

    const rule = await prisma.earlyWarningAlertRule.update({
      where: { id },
      data: {
        isActive: !currentRule.isActive
      }
    });

    const parsedRule = {
      ...rule,
      alertTypes: Array.isArray(rule.alertTypes) ? rule.alertTypes : JSON.parse(rule.alertTypes as string),
      requiredPhases: rule.requiredPhases ? (Array.isArray(rule.requiredPhases) ? rule.requiredPhases : JSON.parse(rule.requiredPhases as string)) : null,
      requiredTriggers: rule.requiredTriggers ? (Array.isArray(rule.requiredTriggers) ? rule.requiredTriggers : JSON.parse(rule.requiredTriggers as string)) : null
    };

    logInfo(`Early warning alert rule ${rule.isActive ? 'activated' : 'deactivated'}: ${id}`);

    return res.json({
      success: true,
      data: parsedRule
    });
  } catch (error) {
    logError('Error toggling early warning alert rule', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle early warning alert rule'
    });
  }
});

// Check early warning alert rules against provided coins with fresh 3-phase analysis
router.post('/check', async (req, res) => {
  try {
    const { coins } = req.body;

    if (!coins || !Array.isArray(coins)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coins data provided'
      });
    }

    logInfo(`Checking early warning alert rules against ${coins.length} coins`);

    // Get all active early warning alert rules
    const rules = await prisma.earlyWarningAlertRule.findMany({
      where: { isActive: true }
    });

    if (rules.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No active early warning alert rules to check'
      });
    }

    const triggeredAlerts: any[] = [];

    // Check each coin against each rule by performing fresh 3-phase calculations
    for (const coin of coins) {
      try {
        // Perform fresh 3-phase early warning analysis for this coin
        if (!realTimeService) {
          logError('Real-time service not available for early warning analysis');
          continue;
        }

        const earlyWarningService = realTimeService.getEarlyWarningService();
        if (!earlyWarningService) {
          logError('Early warning service not available');
          continue;
        }

        const analysis = await earlyWarningService.analyzeSymbol(coin.symbol);
        if (!analysis) {
          continue; // No analysis result for this coin
        }



        // Check each rule against this coin's early warning analysis
        for (const rule of rules) {
          const alertTypes = Array.isArray(rule.alertTypes) ? rule.alertTypes : JSON.parse(rule.alertTypes as string);

          // Check if confidence meets minimum threshold
          if (analysis.confidence < rule.minConfidence) {
            continue;
          }

          // Check if alert type matches
          if (!alertTypes.includes(analysis.alertType)) {
            continue;
          }

          // Create triggered alert
          const triggeredAlert = {
            ruleId: rule.id,
            ruleName: rule.name,
            symbol: coin.symbol,
            coinName: coin.name,
            alertType: analysis.alertType,
            confidence: analysis.confidence,
            priority: rule.priority,
            phases: analysis.phases || [],
            phaseScores: {
              phase1: analysis.phase1Score || 0,
              phase2: analysis.phase2Score || 0,
              phase3: analysis.phase3Score || 0
            },
            timeEstimate: analysis.timeEstimate || 'Unknown',
            currentPrice: coin.price,
            volume24h: coin.volume,
            priceChange24h: coin.priceChange24h,
            triggeredBy: analysis.triggeredBy || [],
            message: `${analysis.alertType.replace('_', ' ')} signal detected for ${coin.symbol} with ${analysis.confidence}% confidence`,
            timestamp: new Date().toISOString()
          };

          triggeredAlerts.push(triggeredAlert);

          // Save to main Early Warning Alert table (only rule-matched alerts)
          const savedAlert = await prisma.earlyWarningAlert.create({
            data: {
              symbol: coin.symbol,
              exchange: 'binance',
              alertType: analysis.alertType,
              confidence: analysis.confidence,
              timeEstimateMin: analysis.timeEstimateMin || 0,
              timeEstimateMax: analysis.timeEstimateMax || 0,
              volumeSpike: analysis.volumeSpike ? analysis.volumeSpike : undefined,
              rsiMomentum: analysis.rsiMomentum ? analysis.rsiMomentum : undefined,
              emaConvergence: analysis.emaConvergence ? analysis.emaConvergence : undefined,
              bidAskImbalance: analysis.bidAskImbalance ? analysis.bidAskImbalance : undefined,
              priceAction: analysis.priceAction ? analysis.priceAction : undefined,
              whaleActivity: analysis.whaleActivity ? analysis.whaleActivity : undefined,
              phase1Score: analysis.phase1Score || 0,
              phase2Score: analysis.phase2Score || 0,
              phase3Score: analysis.phase3Score || 0,
              triggeredBy: analysis.triggeredBy || [],
              currentPrice: coin.price,
              volume24h: coin.volume || 0,
              priceChange24h: coin.priceChange24h || 0,
              isActive: true,
              isResolved: false
            }
          });

          // Debug: Log what was saved to database
          logInfo(`Saved alert to database for ${coin.symbol}:`, {
            id: savedAlert.id,
            phase1Score: savedAlert.phase1Score,
            phase2Score: savedAlert.phase2Score,
            phase3Score: savedAlert.phase3Score,
            confidence: savedAlert.confidence
          });

          // Save to database - Early Warning Alert History (for rule tracking)
          await prisma.earlyWarningAlertHistory.create({
            data: {
              ruleId: rule.id,
              ruleName: rule.name,
              earlyWarningId: savedAlert.id, // Reference to the main alert
              symbol: coin.symbol,
              alertType: analysis.alertType,
              confidence: analysis.confidence,
              timeEstimateMin: analysis.timeEstimateMin || 0,
              timeEstimateMax: analysis.timeEstimateMax || 0,
              triggeredBy: analysis.triggeredBy || [],
              currentPrice: coin.price,
              volume24h: coin.volume || 0,
              priceChange24h: coin.priceChange24h || 0,
              priority: rule.priority,
              message: triggeredAlert.message,
              phase1Score: analysis.phase1Score || 0,
              phase2Score: analysis.phase2Score || 0,
              phase3Score: analysis.phase3Score || 0,
              volumeSpike: analysis.volumeSpike ? analysis.volumeSpike : undefined,
              rsiMomentum: analysis.rsiMomentum ? analysis.rsiMomentum : undefined,
              emaConvergence: analysis.emaConvergence ? analysis.emaConvergence : undefined,
              bidAskImbalance: analysis.bidAskImbalance ? analysis.bidAskImbalance : undefined,
              priceAction: analysis.priceAction ? analysis.priceAction : undefined,
              whaleActivity: analysis.whaleActivity ? analysis.whaleActivity : undefined
            }
          });

          // Update rule's last triggered time and trigger count
          await prisma.earlyWarningAlertRule.update({
            where: { id: rule.id },
            data: {
              lastTriggered: new Date(),
              triggerCount: { increment: 1 }
            }
          });

          logInfo(`Early warning alert rule triggered: ${rule.name} for ${coin.symbol} (${analysis.alertType}, ${analysis.confidence}% confidence)`);

          // Broadcast to Early Warning System UI (Recent tab)
          if (io) {
            const alertPayload = {
              id: savedAlert.id,
              type: 'EARLY_WARNING',
              symbol: coin.symbol,
              alertType: analysis.alertType,
              confidence: analysis.confidence,
              timeEstimate: `${analysis.timeEstimateMin || 0}-${analysis.timeEstimateMax || 0} min`,
              timeEstimateMin: analysis.timeEstimateMin || 0,
              timeEstimateMax: analysis.timeEstimateMax || 0,
              triggeredBy: analysis.triggeredBy || [],
              currentPrice: coin.price,
              phase1Score: analysis.phase1Score || 0,
              phase2Score: analysis.phase2Score || 0,
              phase3Score: analysis.phase3Score || 0,
              timestamp: new Date().toISOString()
            };

            io.emit('earlyWarning', alertPayload);
            logInfo(`Early warning alert broadcast for ${coin.symbol}: ${analysis.alertType} (Rule: ${rule.name})`);
          }

          // Broadcast toast notification via WebSocket
          if (io) {
            const toastPayload = {
              id: `toast_${Date.now()}_${coin.symbol}`,
              type: 'EARLY_WARNING_TOAST',
              symbol: coin.symbol,
              alertType: analysis.alertType,
              confidence: analysis.confidence,
              timeEstimate: `${analysis.timeEstimateMin || 0}-${analysis.timeEstimateMax || 0} min`,
              triggeredBy: analysis.triggeredBy || [],
              currentPrice: coin.price,
              ruleName: rule.name,
              priority: rule.priority,
              message: triggeredAlert.message,
              timestamp: new Date().toISOString(),
              duration: 30000 // 30 seconds
            };

            io.emit('earlyWarningToast', toastPayload);
            logInfo(`Early warning toast broadcast for ${coin.symbol}: ${analysis.alertType} (Rule: ${rule.name})`);
          }
        }
      } catch (error) {
        logError(`Error analyzing coin ${coin.symbol} for early warning alerts`, error as Error);
        continue;
      }
    }

    logInfo(`Early warning alert rules check completed: ${triggeredAlerts.length} alerts triggered`);

    return res.json({
      success: true,
      data: triggeredAlerts,
      message: `Checked ${rules.length} rules against ${coins.length} coins, ${triggeredAlerts.length} alerts triggered`
    });

  } catch (error) {
    logError('Error checking early warning alert rules', error as Error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check early warning alert rules'
    });
  }
});

export default router;
