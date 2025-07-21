import express from 'express';
import cors from 'cors';
import priceRoutes from './routes/priceRoutes';

const app = express();
const PORT = process.env.PORT || 5001;

// Basic CORS
app.use(cors());

// Body parsing
app.use(express.json());

// API routes
app.get('/api/test', (_req, res) => {
    res.json({ message: 'Test endpoint working' });
});

app.use('/api/prices', priceRoutes);

// Basic routes
app.get('/', (_req, res) => {
    res.json({
        message: 'Crypto Assistant API',
        version: '1.0.0',
        status: 'running',
    });
});

app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
});

export default app;
