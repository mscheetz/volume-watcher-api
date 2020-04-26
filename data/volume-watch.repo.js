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
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", volume
    from public."volumeWatch";`;

    try {
        const res = await pool.query(sql);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get all indicators for an exchange
 * @param {string} exchange exchange name
 */
const getByExchange = async(exchange) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", volume
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
 * Get all indicators for an exchange
 * @param {string} exchange exchange name
 * @param {string} symbol symbol of indicator
 */
const getByExchangeAndSymbol = async(exchange, symbol) => {
    const sql = `select id, symbol, exchange, size, open, high, low, close, "closeTime", volume
    from public."volumeWatch"
    where exchange = $1 and symbol = $2;`;

    try {
        const res = await pool.query(sql, [exchange, symbol]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * get available exchanges
 */
const getExchanges = async() => {
    const sql = `select distinct exchange
    from public."volumeWatch"
    order by 1`;

    try {
        const res = await pool.query(sql);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * get all symbols indicated
 */
const getAllSymbols = async() => {
    const sql = `select distinct symbol, exchange, size
    from public."volumeWatch"
    order by 2, 1, 3`;

    try {
        const res = await pool.query(sql);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * get symbols indicated for an exchange
 * @param {string} exchange exchange name
 */
const getSymbols = async(exchange) => {
    const sql = `select distinct symbol, size
    from public."volumeWatch"
    where exchange = $1
    order by 1, 2`;

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
    const sql = `INSERT INTO public."volumeWatch" ( symbol, exchange, size, open, high, low, close, "closeTime", volume )
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9 ) `;
    let params = [
        data.symbol,
        data.exchange,
        data.size,
        data.open,
        data.high,
        data.low,
        data.close,
        data.closeTime,
        data.volume
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
    getByExchange,
    getByExchangeAndSymbol,
    getExchanges,
    getAllSymbols,
    getSymbols,
    add,
    addMany,
    cleanExchange
}