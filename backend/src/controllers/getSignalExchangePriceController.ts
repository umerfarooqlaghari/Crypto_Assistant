import { getBTCPriceFromExchange } from "../Services/ccxtService";

export const getSingleExchangePrice = async (req: any, res: any) => {
    try {
const { exchange } = req.params;
const price = await getBTCPriceFromExchange(exchange, 'BTC/USDT');
res.json({ exchange, price });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching price' });
    }
};