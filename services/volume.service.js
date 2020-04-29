const binanceSvc = require('./binance.service');
const amqRepo = require('./queue.broker');
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

const getSizes = async() => {
    const sizes = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

    return sizes;
}

module.exports = {
    runVolumeCheck,
    runOverageCheck,
    customRun,
    customRunNoQueue,
    readQueue,
    queueProcessor,
    getSizes
}