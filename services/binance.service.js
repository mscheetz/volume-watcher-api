const Binance = require('node-binance-api');
const binance = new Binance();
const _ = require('lodash');
const volumeRepo = require('../data/volume-watch.repo');
const amqRepo = require('../data/amq.repo');
const coreSvc = require('./core.service');
const config = require('../config');
const _exchange = "BINANCE";
const basePercent = config.BASE_PERCENT;
let _volumePercent = config.BASE_PERCENT;
let promisesRecvd = 0;
let broker;

const cleanMe = async() => {    
    console.info(`Cleaning up ${_exchange} info`);
    await volumeRepo.cleanExchange(_exchange);
}

const customRun = async(size, percent) => {
    console.info(`Running custom ${_exchange} check! size: '${size}', percent '${percent}'`)
    _volumePercent = +percent;
    const pairs = await getTradingPairs();
    const uuid = coreSvc.getUuid();
    broker = await amqRepo.getInstance();

    await findIndicators(pairs, size, true, uuid);

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

const getTradingPairs = async() => {
    const exchangeInfo = await binance.exchangeInfo();
    const pairs = exchangeInfo.symbols.filter(s => s.status === "TRADING" && (s.quoteAsset === "BTC" || s.quoteAsset === "USDT")).map(s => s.symbol);

    return pairs;
}

const findIndicators = async(pairs, size, custom = false, uuid = "") => {
    console.log('check candlesticks');
    //pairs = ["BTCUSDT", "ETHBTC", "LTCBTC"];
    //size = "1h";

    for await (const pair of pairs) {
        binance.candlesticks(pair, size, async(err, ticks, pair) => {
            if(typeof ticks !== 'undefined' && ticks.length > 0) {
                console.info(`checking ${pair}`);
                let sticks = getTicks(ticks, size);
                sticks = sticks.reverse();
                if(sticks.length > 0) {
                    const addIndicator = await volumeVerify(sticks);

                    if(addIndicator) {
                        console.info(`${pair} ${size} volume increase to report!`)
                        const indicator = createVolumeWatch(sticks, pair, size);

                        if(!custom) {
                            await volumeRepo.add(indicator);
                        } else {
                            await sendToQueue(uuid, indicator);
                        }
                    } else {
                        console.error(`${pair} ${size} no volume increase to report`)
                    }
                }
                
                console.info(`${pair} ${size} done`)
            } else {
                console.error(`${pair} no result`)
            }
            promisesRecvd++;
          }, { limit: 50 });
    }
}

const sendToQueue = async(queue, message) => {
    await broker.send(queue, message);
}

const createVolumeWatch = function(sticks, pair, size) {
    let obj = {
        symbol: pair,
        exchange: _exchange,
        size: size,
        open: sticks[0].open,
        high: sticks[0].high,
        low: sticks[0].low,
        close: sticks[0].close,
        closeTime: sticks[0].closeTime,
        volume: sticks[0].volume,
        volumePlus1: sticks[1].volume,
        volumePlus2: 0.0,
        volumePlus4: 0.0,
        volumePlus6: 0.0,
        volumePlus8: 0.0,
        volumePlus12: 0.0,
        volumePlus18: 0.0,
        volumePlus24: 0.0,
        volumePlus48: 0.0
    };

    if(sticks.length > 2) {
        obj.volumePlus2 = sticks[2].volume;
    }
    if(sticks.length > 4) {
        obj.volumePlus4 = sticks[4].volume;
    }
    if(sticks.length > 6) {
        obj.volumePlus6 = sticks[6].volume;
    }
    if(sticks.length > 8) {
        obj.volumePlus8 = sticks[8].volume;
    }
    if(sticks.length > 12) {
        obj.volumePlus12 = sticks[12].volume;
    }
    if(sticks.length > 18) {
        obj.volumePlus18 = sticks[18].volume;
    }
    if(sticks.length > 24) {
        obj.volumePlus24 = sticks[24].volume;
    }
    if(sticks.length > 48) {
        obj.volumePlus48 = sticks[48].volume;
    }
    return obj;
}

const volumeVerify = async(sticks) => {
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
    runCheck,
    customRun
}