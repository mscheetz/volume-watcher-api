const UUID = require('uuid-js');

const getUuid = function() {
    const uuid4 = UUID.create();

    return uuid4.toString();
}

module.exports = {
    getUuid
}