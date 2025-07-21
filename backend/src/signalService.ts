import axios from 'axios';

export async function getSignals()
{
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
            symbol: 'BTCUSDT',
            interval: '1m',
            limit: 5,
        }
    });

    const candles = response.data;

    const close1 = parseFloat(candles[candles.length - 3][4]);
    const close2 = parseFloat(candles[candles.length - 2][4]);
    const close3 = parseFloat(candles[candles.length - 1][4]);
    
        const signal = close3 > close2 && close2> close1 ? 'BUY':
                       close3 < close2 && close2< close1 ?'SELL' : 'HOLD';
                       
                       return {signal, close1, close2, close3};
}