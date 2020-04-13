const Binance = require('node-binance-api');
const binance = new Binance();
const candleRepo = require('../data/candle.repo');
const symbolRepo = require('../data/symbol.repo');
const volumeRepo = require('../data/volume-watch.repo');
const _ = require('lodash');
const _exchange = "BINANCE";
const _volumePercent = 0.10;

const runCheck = async() => {
    console.info(`Running ${_exchange} check`)

    await volumeRepo.cleanExchange(_exchange);

    const pairs = await getTradingPairs();

    await findIndicators(pairs);
}

const getTradingPairs = async() => {
    const exchangeInfo = await binance.exchangeInfo();
    const pairs = exchangeInfo.symbols.filter(s => s.status === "TRADING" && (s.quoteAsset === "BTC" || s.quoteAsset === "USDT")).map(s => s.symbol);

    return pairs;
}

const findIndicators = async(pairs) => {
    console.log('check candlesticks');
    //pairs = ["BTCUSDT", "ETHBTC", "LTCBTC"];
    const size = "1h";

    for await (const pair of pairs) {
        binance.candlesticks(pair, size, async(err, ticks, pair) => {
            if(typeof ticks !== 'undefined' && ticks.length > 0) {
                console.info(`checking ${pair}`);
                let sticks = getTicks(ticks, size);
                sticks = sticks.reverse();
                if(sticks.length > 0) {
                    const addIndicator = await volumeVerify(sticks);

                    if(addIndicator) {
                        console.info(`${pair} volume increase to report!`)
                        const indicator = createVolumeWatch(sticks, pair);

                        await volumeRepo.add(indicator);
                    } else {
                        console.error(`${pair} no volume increase to report`)
                    }
                }
                
                console.info(`${pair} done`)
            } else {
                console.error(`${pair} no result`)
            }
          }, { limit: 50 });
    }
}

const createVolumeWatch = function(sticks, pair) {

    return {
        symbol: pair,
        exchange: _exchange,
        open: sticks[0].open,
        high: sticks[0].high,
        low: sticks[0].low,
        close: sticks[0].close,
        closeTime: sticks[0].closeTime,
        volume: sticks[0].volume,
        volume1hr: sticks[1].volume,
        volume2hr: sticks[2].volume,
        volume4hr: sticks[4].volume,
        volume6hr: sticks[6].volume,
        volume8hr: sticks[8].volume,
        volume12hr: sticks[12].volume,
        volume18hr: sticks[18].volume,
        volume24hr: sticks[24].volume,
        volume48hr: sticks[48].volume
    };
}

const volumeVerify = async(sticks) => {
    const volumeBases = 
    [
        +sticks[0].volume,
        +sticks[1].volume
    ];
    const volumes = [ 
        +sticks[1].volume, 
        +sticks[2].volume, 
        +sticks[4].volume, 
        +sticks[6].volume, 
        +sticks[8].volume, 
        +sticks[12].volume, 
        +sticks[18].volume, 
        +sticks[24].volume, 
        +sticks[48].volume
    ];

    let volumeIncrease = false;
    for(let i = 0; i < volumeBases.length; i++) {
        volumes.forEach(vol => {
            if(!volumeIncrease && vol < volumeBases[i]) {
                const diff = volDiff(volumeBases[i], vol);
                if(diff >= _volumePercent) {
                    volumeIncrease = true;
                }
            }
        });
        if(volumeIncrease) {
            break;
        }
    }

    return volumeIncrease;
}

const volDiff = function(a, b) {
    const top = a - b;
    const bottom = (a + b) /2;
    return top / bottom;
}

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
    let lastTS = await candleRepo.getLastTS(_exchange);
    if(typeof lastTS === 'undefined' || lastTS.length === 0) {
        lastTS = 0;
    } else {
        lastTS = +lastTS[0].closeTime;
    }

    for await (const symbol of symbols.map(s => s.symbol)) {
        binance.candlesticks(symbol, size, async(err, ticks, symbol) => {
            if(typeof ticks !== 'undefined' && ticks.length > 0) {
                let sticks = getTicks(ticks, size, lastTS);
                if(sticks.length > 0) {
                    await candleRepo.addMany(sticks, _exchange, symbol);
                }
                
                console.info(`${symbol} done`)
            } else {
                console.error(`${symbol} no result`)
            }
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

const getTicksOG = function(ticks, size, lastTS) {
    let sticks = [];
    const unixTS = + new Date();
    ticks.forEach(tick => {
        let stick = getTick(tick, size);
        if(stick.closeTime < unixTS && stick.closeTime > lastTS) {
            sticks.push(stick);
        } else {
            console.log(`stick time ${stick.closeTime} is in the future`)
        }
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
    runCheck,
    symbolCheck,
    stickCheck
}