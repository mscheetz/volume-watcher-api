const Binance = require('node-binance-api');
const binance = new Binance();
const _ = require('lodash');
const volumeRepo = require('../data/volume-watch.repo');
const volumeIncrRepo = require('../data/volume-increase.repo');
const amqRepo = require('./queue.broker');
const coreSvc = require('./core.service');
const config = require('../config');
const _exchange = "BINANCE";
const basePercent = config.BASE_PERCENT;
let _volumePercent = config.BASE_PERCENT;
let promisesRecvd = 0;
let promisesSent = 0;
let broker;
let increments = [];
let arbitrages = [];

const cleanMe = async() => {    
    await volumeRepo.cleanExchange(_exchange);
}

const cleanMeIncr = async() => {    
    await volumeIncrRepo.cleanExchange(_exchange);
}

const customRun = async(size, percent, btc, usdt) => {
    _volumePercent = +percent;
    const pairs = await getTradingPairs(btc, usdt);
    const uuid = coreSvc.getUuid();
    broker = await amqRepo.getInstance();

    await findIndicators(pairs, size, true, uuid);

    _volumePercent = basePercent;
    
    return uuid;
}

const customRunNoQueue = async(size, percent, callback) => {
    _volumePercent = +percent;
    const pairs = await getTradingPairs();
    const uuid = coreSvc.getUuid();
    broker = await amqRepo.getInstance();

    await findIndicators(pairs, size, true, uuid, callback);

    _volumePercent = basePercent;
    
    return uuid;
}

const runCheck = async(sizes) => {
    console.info(`Running ${_exchange} Volume check`)

    const pairs = await getTradingPairs();
    let promises = [];
    sizes.forEach(size => {
        promises.push(findIndicators(pairs, size));
    });
    await Promise.all(promises);
}

const runOverageCheck = async() => {
    console.info(`Running ${_exchange} Overage check`)

    const pairs = await getTradingPairs();
    let promises = [];
    let sizes = [ "1d", "3d", "1w" ];

    promisesSent = (pairs.length * sizes.length);
    increments = [];
    sizes.forEach(size => {
        promises.push(findDaysOverAverage(pairs, size));
    });

    await Promise.all(promises);
}

const getArbitrage = async() => {
    const tickers = await binance.prices();
    const exchangeInfos = await binance.exchangeInfo();
    let pairs = [];
    
    exchangeInfos.symbols.forEach(symbol => {
        if(symbol.status === "TRADING") {
            const price = tickers[symbol.symbol];
            pairs.push([symbol.symbol, symbol.baseAsset, symbol.quoteAsset, price]);
        }
    })
    let usdts = pairs.filter(p => p[2] === 'USDT');
    arbitrages = [];
    usdts.forEach(usdt => {
        let value = 100 / +usdt[3];
        const path = {
            exchange: _exchange,
            previous: "USDT",
            value: value,
            pair: usdt[0],
            price: usdt[3],
            unit: usdt[1],
            continue: true,
            final: 0
        }
        arbitrages.push([path]);
    });

    await arbitrageIncrement(pairs);

    //console.log('arbitrages', arbitrages.length);
    let profits = [];
    let max = 0;
    let maxTrade = [];
    arbitrages.forEach(arb => {
        let end = arb.length - 1;
        if(arb[end].value > 100) {
            if(arb[end].value > max) {
                max = arb[end].value;
                maxTrade = arb;
            }
            let currentTrade = Array.from(arb);
            currentTrade[0].final = arb[end].value;
            profits.push(currentTrade);
        }
    });
    //console.log('profits', profits.length);

    return profits;
}

const arbitrageIncrement = async(pairs) => {
    let iteration = 10;
    while(iteration > 0){
        for(let i = arbitrages.length - 1; i >= 0; i--) {
            let path = arbitrages[i];
            await arbitragePath(path, i, pairs);
        }
        iteration--;
    }
}

const arbitragePath = async(path, idx, pairs) => {
    const latestPath = path[path.length -1];
    const startingTrade = path[0];
    const latestPair = pairs.filter(p => p[0] === latestPath.pair)[0];
    const initialPath = Array.from(path);
    const potentialPaths = pairs.filter(p => p[1] === path[0][1] || p[2] === path[0][1]);

    if(path.length === 1 || latestPair[2] !== 'USDT'){
        const nexts = pairs.filter(p => ( p[1] === startingTrade.unit 
                                            && ( p[2] === 'BNB' 
                                              || p[2] === 'BTC' 
                                              || p[2] === 'ETH' 
                                              || p[2] === 'TRX' 
                                              || p[2] === 'USDT' 
                                              || p[2] === 'XRP' ))
                                    //  || p[0] === 'TRXBNB'
                                    //  || p[0] === 'XRPBNB'
                                    //  || p[0] === 'BNBBTC' 
                                    //  || p[0] === 'ETHBTC' 
                                    //  || p[0] === 'TRXBTC'
                                    //  || p[0] === 'XRPBTC' 
                                    //  || p[0] === 'TRXETH'
                                    //  || p[0] === 'XRPETH'
                                     || p[0] === 'BNBUSDT' 
                                     || p[0] === 'BTCUSDT' 
                                     || p[0] === 'ETHUSDT' 
                                     || p[0] === 'TRXUSDT' 
                                     || p[0] === 'XRPUSDT' );
        //pairs.filter(p => p[1] === latestPair[1]);
        let i = 0;
        let more = true;
        if(nexts.length > 0) {
            nexts.forEach(next => {
                if(initialPath.unit === "NEO") {
                    console.log(initialPath.unit);
                }
                let trail = Array.from(initialPath);
                if(path.filter(p => p.pair === next[0]).length === 0
                    && ( latestPath.unit === next[1] || latestPath.unit === next[2])) {
                    more = next[2] === 'USDT' ? false : true;
                    const price = +next[3];
                    let value = latestPath.unit === next[1]
                    ? latestPath.value * price
                    : latestPath.value / price;
                    //value = next[2] === 'USDT' ? value.toFixed(4) : value.toFixed(8);
                    value = next[2] === 'BTC' || next[2] === 'ETH'
                        ? value.toFixed(8) : value.toFixed(4);
                    const item = {
                        exchange: _exchange,
                        previous: latestPath.pair,
                        value: value,
                        pair: next[0],
                        price: next[3],
                        unit: next[2],
                        continue: more
                    }
                    i++;
                    trail.push(item);
                    if(i === 1) {
                        arbitrages[idx] = trail;
                    } else {
                        arbitrages.push(trail);
                    }
                }
            });
        } else {
            more = false;
        }
    }
}

const nextVal = function(start, value, pairs, paths) {
    let current = pairs.filter(p => p[0] === start)[0];
    let nexts = pairs.filter(p => p[1] === current[1]);

    let i = 0;
    let more = true;
    if(nexts.length > 0) {
        nexts.forEach(next => {
            if(paths.filter(p => p.pair === next[0]).length === 0) {
                more = next[2] === 'USDT' ? false : true;
                value = value / +next[3];
                const item = {
                    previous: start,
                    value: value,
                    pair: next[0],
                    price: next[3],
                    continue: more
                }
                i++;
                paths.push(item);
            }
        });
    } else {
        more = false;
    }
    if(!more) {
        return paths;
    } else {
        nextVal()
    }

}

const getLatest = async(pair) => {
    const size = "1d";

    const latestTick = await binance.candlesticks(pair, size, false, { limit: 1 });

    const latest = getTicks(latestTick, size);

    return latest;
}

const getTradingPairs = async(btc = true, usdt = true) => {
    try{
        const exchangeInfo = await binance.exchangeInfo();
        let symbols = exchangeInfo.symbols.filter(s => s.status === "TRADING");
        let pairs = [];
        if(btc) {
            let btcSymbols = symbols.filter(s => s.quoteAsset === "BTC").map(s => s.symbol);
            btcSymbols.forEach(b => {
                pairs.push(b);
            })
        }
        if(usdt) {
            let usdtSymbols = symbols.filter(s => s.quoteAsset === "USDT").map(s => s.symbol);
            usdtSymbols.forEach(u => {
                pairs.push(u);
            })
        }

        return pairs;
    } catch(err) {
        console.error(err);
    }
}

const findIndicators = async(pairs, size, custom = false, uuid = "", callback = null) => {
    for await (const pair of pairs) {
        binance.candlesticks(pair, size, async(err, ticks, pair) => {
            if(typeof ticks !== 'undefined' && ticks.length > 0) {
                let sticks = getTicks(ticks, size);
                
                if(sticks.length > 0) {
                    const addIndicator = await coreSvc.volumeVerify(pair, sticks, _volumePercent);

                    if(addIndicator) {
                        const indicator = createCustomVolumeWatch(sticks, pair, size);
                                
                        console.log(`Volume: Adding ${indicator.symbol}`);

                        if(!custom) {
                            await volumeRepo.add(indicator);
                        } else {
                            await sendToQueue(uuid, indicator);
                        }
                    }
                }
            }
            promisesRecvd++;
          }, { limit: 100 });
    }
}

const findDaysOverAverage = async(pairs, size, custom = false, uuid = "", callback = null) => {
    for await (const pair of pairs) {
        //console.log(`calling ${pair} for  ${size}`);
        binance.candlesticks(pair, size, async(err, ticks, pair) => {
            if(typeof ticks !== 'undefined' && ticks.length > 0) {
                let sticks = getTicks(ticks, size);

                if(sticks.length > 0) {
                    const daysOver = await coreSvc.sticksOverAverage(pair, sticks, size);
                    const sizeIndicator = size === "1d" 
                        ? createCustomVolumeWatch(sticks, pair, size) 
                        : null;
                    let volumes = _.takeRight(sticks, 50).map(s => s.volume); 
                    
                    const thisIndicator = {
                        pair: pair,
                        size: size,
                        indicator: sizeIndicator,
                        daysOver: daysOver.overs,
                        volume: volumes, 
                        volumeAverages: daysOver.avgs,
                        voa: daysOver.voa,
                        stickLen: sticks.length
                    };
                    increments.push(thisIndicator);
                    
                    const match = increments.filter(i => i.pair === pair);
                    if(match.length > 2) {
                        const oneDay = match.filter(m => m.size === "1d")[0];
                        const threeDay = match.filter(m => m.size === "3d")[0];
                        const oneWeek = match.filter(m => m.size === "1w")[0];
                        if(typeof oneDay !== 'undefined' && typeof threeDay !== 'undefined' && typeof oneWeek !== 'undefined') {
                            let daysOver = oneDay.daysOver;
                            daysOver.push(threeDay.daysOver[0]);
                            daysOver.push(oneWeek.daysOver[0]);
                            let volumeAvgs = oneDay.volumeAverages;
                            volumeAvgs.push(threeDay.volumeAverages[0]);
                            volumeAvgs.push(oneWeek.volumeAverages[0]);
                            const max = Math.max(...daysOver);
                            let voas = oneDay.voa;
                            voas.push(threeDay.voa[0]);
                            voas.push(oneWeek.voa[0]);
                            const stickLen = [ oneDay.stickLen, threeDay.stickLen, oneWeek.stickLen ];

                            if(daysOver.length > 0 && max > 0) {
                                let indicator = oneDay.indicator;
                                indicator.daysOver = daysOver;
                                indicator.volume1d = oneDay.volume;
                                indicator.volume3d = threeDay.volume;
                                indicator.volume1w = oneWeek.volume;
                                indicator.volumeAverages = volumeAvgs;
                                indicator.accumulation3D = threeDay.daysOver[0] > 0;
                                indicator.accumulationWeekly = oneWeek.daysOver[0] > 0;
                                indicator.voaPercent = voas;
                                indicator.stickLen = stickLen;
                                delete indicator.volume;
                                
                                console.log(`VOA: Adding ${indicator.symbol}`);
                                
                                if(!custom) {
                                    await volumeIncrRepo.add(indicator);
                                } else {
                                    await sendToQueue(uuid, indicator);
                                }
                            }
                            let removeMe = [ pair ];
                            increments = increments.filter(i => !removeMe.includes(i.pair));
                        }
                    } 
                }
            }
            promisesRecvd++;
            if(promisesRecvd === promisesSent) {
                console.log('Overage check complete');
            }
          }, { limit: 1000 });
    }
}

const sendToQueue = async(queue, message) => {
    await broker.send(queue, message);
}

const createCustomVolumeWatch = function(sticks, pair, size, daysOver = []) {
    const idx = sticks.length - 1;
    let volumes = sticks.map(s => s.volume);

    let obj = {
        symbol: pair,
        exchange: _exchange,
        size: size,
        open: sticks[idx].open,
        high: sticks[idx].high,
        low: sticks[idx].low,
        close: sticks[idx].close,
        closeTime: sticks[idx].closeTime,
        volume: volumes
    };

    if(daysOver.length > 0) {
        obj.daysOver = daysOver;
    }

    return obj;
}

const volumeVerify = async(sticks) => {
    let volumeIncrease = false;
    let consecs = 0;

    if(sticks.length < 2) {
        return volumeIncrease;
    }
    const volumeBases = [
        +sticks[0].volume,
        +sticks[1].volume
    ];
    for(let i = 0; i < volumeBases.length; i++) {
        if(!volumeIncrease) {
            sticks.forEach(vol => {
                if(!volumeIncrease && vol > 0 && vol < volumeBases[i]) {
                    const diff = volDiff(volumeBases[i], vol);
                    if(diff >= _volumePercent) {
                        consecs++;
                    }
                    if(consecs > 4) {
                        volumeIncrease = true;
                    }
                }
            });
        }
        if(volumeIncrease) {
            break;
        }
    }

    return volumeIncrease;
}

const volumeVerifyOG = async(sticks) => {
    let volumeIncrease = false;

    if(sticks.length < 2) {
        return volumeIncrease;
    }
    const volumeBases = [
        +sticks[0].volume,
        +sticks[1].volume
    ];
    let volumes = [
        +sticks[1].volume
    ];
    if(sticks.length > 2) {
        volumes.push(+sticks[2].volume);
    }
    if(sticks.length > 4) {
        volumes.push(+sticks[4].volume);
    }
    if(sticks.length > 6) {
        volumes.push(+sticks[6].volume);
    }
    if(sticks.length > 8) {
        volumes.push(+sticks[8].volume);
    }
    if(sticks.length > 12) {
        volumes.push(+sticks[12].volume);
    }
    if(sticks.length > 18) {
        volumes.push(+sticks[18].volume);
    }
    if(sticks.length > 24) {
        volumes.push(+sticks[24].volume);
    }
    if(sticks.length > 48) {
        volumes.push(+sticks[48].volume);
    }
    for(let i = 0; i < volumeBases.length; i++) {
        volumes.forEach(vol => {
            if(!volumeIncrease && vol > 0 && vol < volumeBases[i]) {
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
    cleanMe,
    cleanMeIncr,
    runCheck,
    runOverageCheck,
    customRun,
    customRunNoQueue,
    getLatest,
    getArbitrage
}
