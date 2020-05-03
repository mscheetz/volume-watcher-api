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
let broker;
let increments = [];

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
    console.info(`Running ${_exchange} check`)

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

    increments = [];
    sizes.forEach(size => {
        promises.push(findDaysOverAverage(pairs, size));
    });

    await Promise.all(promises);
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
                        volumeAverages: daysOver.avgs
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

                            if(daysOver.length > 0 && max > 0) {
                                let indicator = oneDay.indicator;
                                indicator.daysOver = daysOver;
                                indicator.volume1d = oneDay.volume;
                                indicator.volume3d = threeDay.volume;
                                indicator.volume1w = oneWeek.volume;
                                indicator.volumeAverages = volumeAvgs;
                                delete indicator.volume;
                                
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
          }, { limit: 1000 });
    }
}

const sendToQueue = async(queue, message) => {
    await broker.send(queue, message);
}

const createCustomVolumeWatch = function(sticks, pair, size, daysOver = []) {
    let volumes = sticks.map(s => s.volume);

    let obj = {
        symbol: pair,
        exchange: _exchange,
        size: size,
        open: sticks[0].open,
        high: sticks[0].high,
        low: sticks[0].low,
        close: sticks[0].close,
        closeTime: sticks[0].closeTime,
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
    customRunNoQueue
}