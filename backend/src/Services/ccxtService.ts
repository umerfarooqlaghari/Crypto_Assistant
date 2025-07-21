import ccxt from 'ccxt';

export const getBTCPriceFromExchange =  async (exchangeId: string , symbol: string) => {
    try{
        const exchangeClass = (ccxt as any)[exchangeId];
        if(!exchangeClass)throw new Error('Exchange ${exchangeId} is not supported');
        const exchange = new exchangeClass();
        const ticker = await exchange.fetchTicker(symbol);
        return ticker.last;
    }
    catch(err)
    {
    console.error('Error fetching price from ${exchangeId}', err);
    throw err;
    }
}; 