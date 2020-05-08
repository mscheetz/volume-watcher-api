const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
    user: config.PGUSER,
    host: config.PGHOST,
    database: config.PGDATABASE,
    password: config.PGPASSWORD,
    port: config.PGPORT,
    ssl: { rejectUnauthorized: false }
});

/**
 * Get all indicators 
 */
const get = async() => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent"
    from public."volumeIncrease"
    order by symbol;`;

    try {
        const res = await pool.query(sql);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get paged results
 * 
 * @param {number} limit records to return
 * @param {number} offset starting record
 */
const getPaged = async(limit, offset) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent"
    from public."volumeIncrease"
    order by symbol
    limit $1
    offset $2;`;

    try {
        const res = await pool.query(sql, [ limit, offset ]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get all indicators 
 */
const getCount = async() => {
    const sql = `select count(*) as count
    from public."volumeIncrease";`;

    try {
        const res = await pool.query(sql);

        return res.rows[0];
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get all indicators for an exchange
 * @param {string} exchange exchange name
 */
const getByExchange = async(exchange) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent"
    from public."volumeIncrease"
    where exchange = $1
    order by symbol;`;

    try {
        const res = await pool.query(sql, [exchange]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get all indicators for an exchange
 * @param {string} exchange exchange name
 * @param {string} symbol symbol of indicator
 */
const getByExchangeAndSymbol = async(exchange, symbol) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent"
    from public."volumeIncrease"
    where exchange = $1 and symbol = $2
    order by symbol;`;

    try {
        const res = await pool.query(sql, [exchange, symbol]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get indicator by symbol
 * @param {string} symbol symbol name
 */
const getBySymbol = async(symbol) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent"
    from public."volumeIncrease"
    where symbol = $1;`;

    try {
        const res = await pool.query(sql, [symbol]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Add multiple indicators for an exchange
 * @param {Array} datas collection of data to add
 */
const addMany = async(datas) => {
    let promises = [];
    datas.forEach(data => {
        promises.push(add(data));
    });
    await Promise.all(promises);
}

/**
 * Add new indicator data
 * @param {object} data indicator data
 */
const add = async(data) => {
    const sql = `INSERT INTO public."volumeIncrease" ( symbol, exchange, size, open, high, low, close, "closeTime", "daysOver", volume1d, volume3d, volume1w, "volAvg", "accumulation3D", "accumulationWeekly", "voaPercent" )
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 ) `;
    let params = [
        data.symbol,
        data.exchange,
        data.size,
        data.open,
        data.high,
        data.low,
        data.close,
        data.closeTime,
        data.daysOver,
        data.volume1d,
        data.volume3d,
        data.volume1w,
        data.volumeAverages,
        data.accumulation3D,
        data.accumulationWeekly,
        data.voaPercent
    ]

    try {
        const res = await pool.query(sql, params);

        return res.rowCount;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Clean up an exchange by name
 * @param {string} exchange exchange name
 */
const cleanExchange = async(exchange) => {
    const sql = `DELETE from public."volumeIncrease"
    WHERE exchange = $1;`;

    try {
        const res = await pool.query(sql, [exchange]);

        return res.rowCount;
    } catch(err) {
        console.log(err);
    }
}

module.exports = {
    get,
    getPaged,
    getCount,
    getByExchange,
    getByExchangeAndSymbol,
    getBySymbol,
    add,
    addMany,
    cleanExchange
}