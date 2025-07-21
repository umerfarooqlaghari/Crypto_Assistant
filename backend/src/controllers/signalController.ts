import { getPriceFromExchange } from "../Services/ccxtService";

export const getMultiExchangeSignal = async(res: any) => {
    try{
        const binancePrice = await getPriceFromExchange('binance', 'BTC/USDT');
        const bitfinexPrice = await getPriceFromExchange('bitfinex', 'BTC/USD');
        const bitstampPrice = await getPriceFromExchange('bitstamp', 'BTC/USD');
        const coinbasePrice = await getPriceFromExchange('coinbase', 'BTC-USD');
        const kucoinPrice = await getPriceFromExchange('kucoin', 'BTC-USDT');
        const krakenPrice = await getPriceFromExchange('kraken', 'XBT/USD');
        const bybitPrice = await getPriceFromExchange('bybit', 'BTC/USD');

        const average = (binancePrice + bitfinexPrice + bitstampPrice + coinbasePrice + kucoinPrice + krakenPrice + bybitPrice) / 7;
        res.json(
            {
                binancePrice, 
                bitfinexPrice,
                bitstampPrice,
                coinbasePrice,
                kucoinPrice,
                krakenPrice,
                bybitPrice,
                averageprice: average,
            }
        );
    }
    catch(error)
    {
        console.error(error);
        res.status(500).json({error: 'Error fetching prices'});
    }
}