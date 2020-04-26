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
console.log(`entering volumeVerify for ${pair}...`);
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
                    console.log(`${pair} stick '${i}' ('${volumeBases[i]}', '${vol}') diff: '${diff}'`);
                    
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
    // const top = a - b;
    // const bottom = (a + b) /2;
    // return top / bottom;
    return +a / +b;
}

module.exports = {
    getUuid,
    volumeVerify,
    volDiff
}