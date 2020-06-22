const binanceSvc = require('./binance.service');
const amqRepo = require('./queue.broker');
const voaRepo = require('../data/volume-increase.repo');
const coreSvc = require('./core.service');
const _sizes = [ "1h", "1d" ];
const tickCount = 100;
let broker;

const runVolumeCheck = async() => {
    await binanceSvc.cleanMe();
    await binanceSvc.runCheck(_sizes);
}

const runOverageCheck = async() => {
    await binanceSvc.cleanMeIncr();
    await binanceSvc.runOverageCheck();
}

const customRun = async(exchange, size, percent, btc = true, usdt = true) => {
    let queueId = "";
    if(exchange === "BINANCE") {
        queueId = await binanceSvc.customRun(size, percent, btc, usdt);
    }

    return queueId;
}

const customRunNoQueue = async(exchange, size, percent, callback) => {
    let queueId = "";
    if(exchange === "BINANCE") {
        queueId = await binanceSvc.customRunNoQueue(size, percent, callback);
    }

    return queueId;
}

const readQueue = async(queueId) => {
    broker = await amqRepo.getInstance();
    let instances = [];

    await broker.subscribe(queueId, (message, ack) => {        
        instances.push(message.content);
        ack();
    });

    return instances;
}

const queueProcessor = async(queueId, emitter, socket) => {
    broker = await amqRepo.getInstance();

    await broker.subscribe(queueId, (message, ack) => {
        const msgString = JSON.parse(message.content.toString());
        socket.emit(emitter, msgString);
    });
}

const getVOAItems = async(emitter, socket) => {
    const items = await voaRepo.get();

    items.forEach(item => {
        socket.emit(emitter, item);
    })
}

const getVOAPaged = async(req, emitter, socket) => {
    const page = req.page | 0;
    const size = req.size | 25;
    const totalRes = await voaRepo.getCount();
    const total = +totalRes.count;
    const pages = Math.ceil(total / size);
    let results = [];
    if(page <= pages) {
        let offset = page === 0 ? 0 : (page * size);

        results = await voaRepo.getPaged(size, offset);
        
        results.forEach(item => {
            socket.emit(emitter, item);
        })
    } else {
        socket.emit(emitter, null);
    }

}

const getSizes = async() => {
    const sizes = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

    return sizes;
}

const getVoaPair = async(pair) => {
    let indicators = await voaRepo.getBySymbol(pair);
    const latest = await binanceSvc.getLatest(pair);

    indicators.forEach(indicator => {
        indicator.open = latest[0].open;
        indicator.close = latest[0].close;
        indicator.high = latest[0].high;
        indicator.low = latest[0].low;
        indicator.closeTime = latest[0].closeTime;
    })

    return indicators;
}

const getPairs = async() => {
    const pairs = await voaRepo.getPairs();
    const map = pairs.map(p => p.symbol);

    return map;
}

const getArbitrage = async() => {
    const trades = await binanceSvc.getArbitrage();
    const sorted = coreSvc.arbitrageSort(trades);

    return sorted;
}

const getArbitrageSocket = async(emitter, socket) => {
    const trades = await getArbitrage();

    if(trades.length === 0) {
        socket.emit(emitter, null);
    } else {
        trades.forEach(trade => {
            socket.emit(emitter, trade);
        });
    }
}

module.exports = {
    runVolumeCheck,
    runOverageCheck,
    customRun,
    customRunNoQueue,
    readQueue,
    queueProcessor,
    getVOAItems,
    getVOAPaged,
    getSizes,
    getVoaPair,
    getPairs,
    getArbitrage,
    getArbitrageSocket
}