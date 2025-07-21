import express from 'express';
import cors from 'cors';

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
 
app.get('/', (_req, res) => {res.send('crypto assistant api')});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
