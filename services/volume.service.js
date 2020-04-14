const binanceSvc = require('./binance.service');
const _sizes = [ "1h", "1d" ];

const runVolumeCheck = async() => {
    await binanceSvc.cleanMe();
    await binanceSvc.runCheck(_sizes);
}

const customRun = async(exchange, size, percent) => {
    let result = [];
    if(exchange === "BINANCE") {
        result = await binanceSvc.customRun(size, percent);
    }

    return result;
}

module.exports = {
    runVolumeCheck,
    customRun
}