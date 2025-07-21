import express from 'express';
import cors from 'cors';
import routes from './routes/signalRoutes';
import priceRoutes from './routes/priceRoutes';
import signalRoutes from './routes/signalRoutes';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://localhost:3000',
        'https://localhost:3001'
    ],
    credentials: true,
}))
app.use(express.json());
app.use('api', routes)
app.use('/api', priceRoutes)
app.use('/api', signalRoutes);
app.get('/', (_req, res) => {res.send('crypto assistant api')});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
