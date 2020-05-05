const UUID = require('uuid-js');
const config = require('../config');
const _ = require('lodash');
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
            volumes.reverse().forEach(vol => {
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
    let overArr = {
        overs: [],
        avgs: []
    };
    if (sticks.length < 2) {
        overArr.overs.push(0);
        overArr.avgs.push(0);

        return overArr;
    }
    const volumes = sticks.map(s => s.volume);
    const volAvg = getAverage(volumes);
    let len = sticks.length < 30 ? sticks.length : 30;
    const l30Avg = getAverage(_.takeRight(volumes, len));
    len = sticks.length < 60 ? sticks.length : 60;
    const l60Avg = getAverage(_.takeRight(volumes, len));
    len = sticks.length < 100 ? sticks.length : 100;
    const l100Avg = getAverage(_.takeRight(volumes, len));
    len = sticks.length < 200 ? sticks.length : 200;
    const l200Avg = getAverage(_.takeRight(volumes, len));
    len = sticks.length < 365 ? sticks.length : 365;
    const l365Avg = getAverage(_.takeRight(volumes, len));
    let overs = 0;
    let over30 = 0;
    let over60 = 0;
    let over100 = 0;
    let over200 = 0;
    let over365 = 0;
    let j = 0;
    for(let i = volumes.length - 1; i >= 0; i--) {
        j++;
        if(+volumes[i] > +volAvg) {
            overs++;
        }
        if(size === "1d") {
            if(+volumes[i] > +l30Avg) {
                over30++;
            }
            if(+volumes[i] > +l60Avg) {
                over60++;
            }
            if(+volumes[i] > +l100Avg) {
                over100++;
            }
            if(+volumes[i] > +l200Avg) {
                over200++;
            }
            if(+volumes[i] > +l365Avg) {
                over365++;
            }
        }
        if(j > 10) {
            break;
        }
    }
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