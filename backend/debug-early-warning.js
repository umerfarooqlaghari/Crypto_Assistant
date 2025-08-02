const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugEarlyWarning() {
  try {
    console.log('🔍 Debugging Early Warning System...\n');

    // Check early warning alert rules
    console.log('📋 Early Warning Alert Rules:');
    const rules = await prisma.earlyWarningAlertRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    if (rules.length === 0) {
      console.log('❌ No early warning alert rules found!');
    } else {
      rules.forEach((rule, index) => {
        console.log(`${index + 1}. Rule: ${rule.ruleName}`);
        console.log(`   - ID: ${rule.id}`);
        console.log(`   - Min Confidence: ${rule.minConfidence}%`);
        console.log(`   - Alert Types: ${rule.alertTypes}`);
        console.log(`   - Priority: ${rule.priority}`);
        console.log(`   - Active: ${rule.isActive}`);
        console.log(`   - Last Triggered: ${rule.lastTriggered || 'Never'}`);
        console.log(`   - Created: ${rule.createdAt}`);
        console.log('');
      });
    }

    // Check early warning alerts (from 3-phase system)
    console.log('🚨 Early Warning Alerts (Last 24 hours):');
    const alerts = await prisma.earlyWarningAlert.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (alerts.length === 0) {
      console.log('❌ No early warning alerts found in the last 24 hours!');
    } else {
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. Alert: ${alert.symbol} - ${alert.alertType}`);
        console.log(`   - ID: ${alert.id}`);
        console.log(`   - Confidence: ${alert.confidence}%`);
        console.log(`   - Time Estimate: ${alert.timeEstimateMin}-${alert.timeEstimateMax} min`);
        console.log(`   - Phase Scores: P1=${alert.phase1Score}, P2=${alert.phase2Score}, P3=${alert.phase3Score}`);
        console.log(`   - Active: ${alert.isActive}`);
        console.log(`   - Resolved: ${alert.isResolved}`);
        console.log(`   - Created: ${alert.createdAt}`);
        console.log('');
      });
    }

    // Check early warning alert history (rule triggers)
    console.log('📜 Early Warning Alert History (Last 24 hours):');
    const history = await prisma.earlyWarningAlertHistory.findMany({
      where: {
        triggeredAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { triggeredAt: 'desc' },
      take: 10
    });

    if (history.length === 0) {
      console.log('❌ No early warning alert history found in the last 24 hours!');
    } else {
      history.forEach((entry, index) => {
        console.log(`${index + 1}. History: ${entry.symbol} - ${entry.alertType}`);
        console.log(`   - Rule ID: ${entry.ruleId}`);
        console.log(`   - Confidence: ${entry.confidence}%`);
        console.log(`   - Priority: ${entry.priority}`);
        console.log(`   - Triggered: ${entry.triggeredAt}`);
        console.log('');
      });
    }

    // Check recent coin data to see if we have symbols being tracked
    console.log('💰 Recent Coin Data (Sample):');
    const coins = await prisma.coinData.findMany({
      orderBy: { lastUpdated: 'desc' },
      take: 5
    });

    if (coins.length === 0) {
      console.log('❌ No coin data found!');
    } else {
      coins.forEach((coin, index) => {
        console.log(`${index + 1}. ${coin.symbol}: $${coin.price} (${coin.priceChange24h}%)`);
        console.log(`   - Volume: ${coin.volume}`);
        console.log(`   - Last Updated: ${coin.lastUpdated}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error debugging early warning system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugEarlyWarning();
