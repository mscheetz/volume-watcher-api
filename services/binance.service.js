const Binance = require('node-binance-api');
const binance = new Binance();
const candleRepo = require('../data/candle.repo');
const symbolRepo = require('../data/symbol.repo');
const _ = require('lodash');
const _exchange = "BINANCE";

const symbolCheck = async() => {
    console.log('checking binance symbols');

    const dbSymbols = await symbolRepo.get(_exchange);
    const dbSymbs = dbSymbols.map(d => d.symbol);

    const exchangeInfo = await binance.exchangeInfo();
    const symbols = exchangeInfo.symbols.filter(s => s.status === "TRADING" && (s.quoteAsset === "BTC" || s.quoteAsset === "USDT")).map(s => s.symbol);

    const dbAdds = _.difference(symbols, dbSymbs);
    const dbRemoves = _.difference(dbSymbs, symbols);

    if(dbAdds.length > 0) {
        await symbolRepo.addMany(dbAdds, _exchange);
    }
    if(dbRemoves.length > 0) {
        await symbolRepo.removeMany(dbRemoves, _exchange);
    }

    console.log('binance symbol check complete');
}

const stickCheck = async() => {
    console.log('check candlesticks');
    const symbols = await symbolRepo.get(_exchange);
    //const symbols = ["BTCUSDT", "ETHBTC", "LTCBTC"];
    const size = "1h";
    const unixTS = + new Date();

    for await (const symbol of symbols) {
        binance.candlesticks(symbol, size, (err, ticks, symbol) => {
            let sticks = getTicks(ticks, size);
            const one = getTick(sticks[sticks.length - 1]);
            const two = getTick(sticks[sticks.length - 2]);
            const three = getTick(sticks[sticks.length - 3]);
            console.info(`${symb} last`, one);
            console.info(`${symb} 2nd to last`, two);
            console.info(`${symb} 3rd to last`, three);
            console.log(`${symb} done`)
          }, { limit: 48 });
    }
}

const getTicks = function(ticks, size) {
    let sticks = [];
    ticks.forEach(tick => {
        let stick = getTick(tick, size);
        sticks.push(stick);
    });

    return sticks;
}

const getTick = function(tick, size) {
    return { 
        time: tick[0], 
        open: tick[1], 
        high: tick[2], 
        low: tick[3], 
        close: tick[4], 
        volume: tick[5], 
        closeTime: tick[6], 
        assetVolume: tick[7], 
        trades: tick[8], 
        buyBaseVolume: tick[9], 
        buyAssetVolume: tick[10], 
        ignored: tick[11],
        size: size
    };
}

module.exports = {
    symbolCheck,
    stickCheck
}