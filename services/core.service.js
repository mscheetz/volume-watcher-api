const UUID = require('uuid-js');
const config = require('../config');
const _minConsec = config.CONSEC_MIN;

const getUuid = function() {
    const uuid4 = UUID.create();

    return uuid4.toString();
}

const volumeVerify = async(pair, sticks, volumePercent) => {
    let volumeIncrease = false;
    let consecs = 0;
    if(sticks.length < 2) {
        return volumeIncrease;
    }
    const volumeBases = [
        +sticks[0].volume,
        +sticks[1].volume
    ];
    const volumes = sticks.map(s => s.volume);
    for(let i = 0; i < volumeBases.length; i++) {
        if(!volumeIncrease) {
            volumes.forEach(vol => {
                if(!volumeIncrease && vol > 0 && vol < volumeBases[i]) {
                    const diff = volDiff(volumeBases[i], vol);
                    
                    if(diff >= volumePercent) {
                        consecs++;
                    }
                    if(consecs > _minConsec) {
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

const volDiff = function(a, b) {
    return +a / +b;
}

const sticksOverAverage = function(pair, sticks, size) {
    if (sticks.length < 2) {
        return 0;
    }
    const volumes = sticks.map(s => s.volume);
    const volAvg = getAverage(volumes);
    const l30Avg = getAverage(volumes.slice(0, 30));
    const l60Avg = getAverage(volumes.slice(0, 60));
    const l100Avg = getAverage(volumes.slice(0, 100));
    const l200Avg = getAverage(volumes.slice(0, 200));
    const l365Avg = getAverage(volumes.slice(0, 365));
    let overs = 0;
    let over30 = 0;
    let over60 = 0;
    let over100 = 0;
    let over200 = 0;
    let over365 = 0;
    for(let i = 0; i < sticks.length; i++) {
        if(+sticks[i].volume > +volAvg) {
            overs++;
        }
        if(size === "1d") {
            if(+sticks[i].volume > +l30Avg) {
                over30++;
            }
            if(+sticks[i].volume > +l60Avg) {
                over60++;
            }
            if(+sticks[i].volume > +l100Avg) {
                over100++;
            }
            if(+sticks[i].volume > +l200Avg) {
                over200++;
            }
            if(+sticks[i].volume > +l365Avg) {
                over365++;
            }
        }
        if(i > 10) {
            break;
        }
    }

    let overArr = {
        overs: [],
        avgs: []
    };
    if(size === "1d") {
        overArr.overs = [ overs, over30, over60, over100, over200, over365 ];
        overArr.avgs = [ volAvg, l30Avg, l60Avg, l100Avg, l200Avg, l365Avg ];
    } else {
        overArr.overs = [ overs ];
        overArr.avgs = [ volAvg ];
    }

    return overArr;
}

const getAverage = function(values) {
    const total = values.reduce((a, b) => +a + +b, 0);
    const len = values.length;
    let average = total / len;
    average = average.toFixed(2);
    
    return average;
}

module.exports = {
    getUuid,
    volumeVerify,
    volDiff,
    sticksOverAverage
}