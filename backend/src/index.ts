import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/config';
import { logger } from './utils/logger';
import priceRoutes from './routes/priceRoutes';
import signalRoutes from './routes/signalRoutes';
import signalExchangePriceRoutes from './routes/signalExchangePriceRoutes';
import enhancedSignalRoutes from './routes/enhancedSignalRoutes';
import { RealTimeDataService } from './Services/realTimeDataService';

const app = express();
const server = createServer(app);

// Initialize real-time data service with WebSocket support
const realTimeService = new RealTimeDataService(server);

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (config.cors.allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow all Vercel preview URLs
        if (origin.includes('vercel.app')) {
            return callback(null, true);
        }

        // Allow localhost for development
        if (origin.includes('localhost')) {
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
// app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
    });
});

// API routes
app.use('/api/prices', priceRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/enhanced-signals', enhancedSignalRoutes);
app.use('/api/exchange-prices', signalExchangePriceRoutes);
// app.use('/api/portfolio', portfolioRoutes);
// app.use('/api/exchanges', exchangeRoutes);

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        message: 'Crypto Assistant API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health',
    });
});

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: 'The requested endpoint does not exist',
    });
});

// Error handling middleware (must be last)
// app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    realTimeService.shutdown();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    realTimeService.shutdown();
    process.exit(0);
});

server.listen(config.port, () => {
    logger.info(`🚀 Server started on port ${config.port} in ${config.nodeEnv} mode`);
    logger.info(`📡 WebSocket server running for real-time data`);
});

export default app;
