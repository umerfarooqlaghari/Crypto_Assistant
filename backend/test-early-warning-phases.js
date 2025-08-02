const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEarlyWarningPhases() {
  try {
    console.log('🧪 Testing Early Warning System Phases...\n');

    // Test 1: Check if early warning alerts are being generated
    console.log('📊 Test 1: Recent Early Warning Alerts (Last 1 hour)');
    const recentAlerts = await prisma.earlyWarningAlert.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (recentAlerts.length === 0) {
      console.log('❌ No early warning alerts generated in the last hour');
    } else {
      console.log(`✅ Found ${recentAlerts.length} alerts in the last hour:`);
      recentAlerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.symbol} - ${alert.alertType} (${alert.confidence}%)`);
        console.log(`   Phase Scores: P1=${alert.phase1Score}, P2=${alert.phase2Score}, P3=${alert.phase3Score}`);
        console.log(`   Triggered by: ${alert.triggeredBy}`);
        console.log(`   Created: ${alert.createdAt}`);
        
        // Check phase data
        if (alert.volumeSpike) {
          console.log(`   📈 Volume Spike: ${JSON.stringify(alert.volumeSpike).substring(0, 100)}...`);
        }
        if (alert.rsiMomentum) {
          console.log(`   📊 RSI Momentum: ${JSON.stringify(alert.rsiMomentum).substring(0, 100)}...`);
        }
        if (alert.emaConvergence) {
          console.log(`   📉 EMA Convergence: ${JSON.stringify(alert.emaConvergence).substring(0, 100)}...`);
        }
        if (alert.bidAskImbalance) {
          console.log(`   💰 Bid/Ask Imbalance: ${JSON.stringify(alert.bidAskImbalance).substring(0, 100)}...`);
        }
        if (alert.priceAction) {
          console.log(`   💹 Price Action: ${JSON.stringify(alert.priceAction).substring(0, 100)}...`);
        }
        if (alert.whaleActivity) {
          console.log(`   🐋 Whale Activity: ${JSON.stringify(alert.whaleActivity).substring(0, 100)}...`);
        }
        console.log('');
      });
    }

    // Test 2: Check early warning alert rules
    console.log('\n📋 Test 2: Early Warning Alert Rules');
    const rules = await prisma.earlyWarningAlertRule.findMany({
      where: { isActive: true }
    });

    if (rules.length === 0) {
      console.log('❌ No active early warning alert rules found');
    } else {
      console.log(`✅ Found ${rules.length} active rules:`);
      rules.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.ruleName || 'Unnamed Rule'}`);
        console.log(`   Min Confidence: ${rule.minConfidence}%`);
        console.log(`   Alert Types: ${rule.alertTypes}`);
        console.log(`   Priority: ${rule.priority}`);
        console.log(`   Last Triggered: ${rule.lastTriggered || 'Never'}`);
        console.log('');
      });
    }

    // Test 3: Check rule triggers (alert history)
    console.log('\n📜 Test 3: Rule Trigger History (Last 1 hour)');
    const ruleHistory = await prisma.earlyWarningAlertHistory.findMany({
      where: {
        triggeredAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour
        }
      },
      orderBy: { triggeredAt: 'desc' },
      take: 10
    });

    if (ruleHistory.length === 0) {
      console.log('❌ No rule triggers in the last hour');
    } else {
      console.log(`✅ Found ${ruleHistory.length} rule triggers:`);
      ruleHistory.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.symbol} - ${entry.alertType}`);
        console.log(`   Rule ID: ${entry.ruleId}`);
        console.log(`   Confidence: ${entry.confidence}%`);
        console.log(`   Priority: ${entry.priority}`);
        console.log(`   Triggered: ${entry.triggeredAt}`);
        console.log('');
      });
    }

    // Test 4: Check if backend is generating alerts with lower thresholds
    console.log('\n🔍 Test 4: Analysis of Alert Generation Issues');
    
    // Check if we have any alerts with confidence >= 30%
    const lowConfidenceAlerts = await prisma.earlyWarningAlert.findMany({
      where: {
        confidence: { gte: 30 },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Alerts with confidence >= 30%: ${lowConfidenceAlerts.length}`);
    
    // Check if we have PUMP_LIKELY or DUMP_LIKELY alerts
    const pumpDumpAlerts = await prisma.earlyWarningAlert.findMany({
      where: {
        alertType: { in: ['PUMP_LIKELY', 'DUMP_LIKELY'] },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`PUMP_LIKELY/DUMP_LIKELY alerts: ${pumpDumpAlerts.length}`);

    // Check if we have alerts that should match the rule
    const matchingAlerts = await prisma.earlyWarningAlert.findMany({
      where: {
        confidence: { gte: 30 },
        alertType: { in: ['PUMP_LIKELY', 'DUMP_LIKELY'] },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last 1 hour
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Alerts matching rule criteria (confidence >= 30% AND type PUMP/DUMP): ${matchingAlerts.length}`);

    if (matchingAlerts.length > 0) {
      console.log('\n✅ Found alerts that should trigger rules:');
      matchingAlerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.symbol} - ${alert.alertType} (${alert.confidence}%)`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing early warning phases:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEarlyWarningPhases();
