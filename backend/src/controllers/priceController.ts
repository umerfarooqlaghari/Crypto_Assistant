import { Request , Response } from 'express';
import {getBTCPriceFromExchange} from '../Services/ccxtService';

export const getBinancePrice  = async (_req: Request, res: Response): Promise<void> =>
{
    try{
    const price = await getBTCPriceFromExchange('binance', 'BTC/USDT');
    res.status(200).json({exchange: 'binance', symbol: 'BTC/USDT', price });

    }
    catch(error)
    {
            console.error(error);
            res.status(500).json({error: 'Error fetching price'});
    }

}