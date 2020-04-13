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
 * Get all indicators for an exchange
 * @param {string} exchange exchange name
 */
const get = async(exchange) => {
    const sql = `select id, symbol, exchange, open, high, low, close, closeTime", volume, "volume1hr", "volume2hr", "volume4hr", "volume6hr", "volume8hr", "volume12hr", "volume18hr", "volume24hr", "volume48hr"
    from public."volumeWatch"
    where exchange = $1;`;

    try {
        const res = await pool.query(sql, [exchange]);

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
    const sql = `INSERT INTO public."volumeWatch" ( symbol, exchange, open, high, low, close, "closeTime", volume, "volume1hr", "volume2hr", "volume4hr", "volume6hr", "volume8hr", "volume12hr", "volume18hr", "volume24hr", "volume48hr" )
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17 ) `;
    let params = [
        data.symbol,
        data.exchange,
        data.open,
        data.high,
        data.low,
        data.close,
        data.closeTime,
        data.volume,
        data.volume1hr,
        data.volume2hr,
        data.volume4hr,
        data.volume6hr,
        data.volume8hr,
        data.volume12hr,
        data.volume18hr,
        data.volume24hr,
        data.volume48hr
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
    const sql = `DELETE from public."volumeWatch"
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
    add,
    addMany,
    cleanExchange
}