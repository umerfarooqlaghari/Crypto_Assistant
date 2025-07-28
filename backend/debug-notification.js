const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugNotification() {
  try {
    // Get the most recent notification
    const notification = await prisma.notification.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (notification) {
      console.log('Most recent notification:');
      console.log('ID:', notification.id);
      console.log('Symbol:', notification.symbol);
      console.log('Timeframe:', notification.timeframe);
      console.log('Triggered Timeframes:', notification.triggeredTimeframes);
      console.log('Technical Indicators structure:');
      console.log(JSON.stringify(notification.technicalIndicators, null, 2));
      console.log('Chart Patterns:', notification.chartPatterns);
      console.log('Candlestick Patterns:', notification.candlestickPatterns);
    } else {
      console.log('No notifications found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugNotification();
