const binanceSvc = require('./binance.service');
const _sizes = [ "1h", "1d" ];

const runVolumeCheck = async() => {
    await binanceSvc.cleanMe();
    await binanceSvc.runCheck(_sizes);
}

const customRun = async(exchange, size, percent) => {
    let queueId = "";
    if(exchange === "BINANCE") {
        queueId = await binanceSvc.customRun(size, percent);
    }

    return queueId;
}

module.exports = {
    runVolumeCheck,
    customRun
}