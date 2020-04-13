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
 * Get sticks for an exchange
 * @param {string} exchange exchange name
 */
const get = async(exchange) => {
    const sql = `select id, exchange, symbol, open, high, low, close, volume, "closeTime", size
    from public."candle"
    where exchange = $1`;

    try {
        const res = await pool.query(sql, [exchange]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get sticks for an exchange
 * @param {string} exchange exchange name
 * @param {string} symbol symbol
 */
const getSymbol = async(exchange, symbol) => {
    const sql = `select id, exchange, symbol, open, high, low, close, volume, "closeTime", size
    from public."candle"
    where exchange = $1 AND symbol = $2`;

    try {
        const res = await pool.query(sql, [exchange, symbol]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Get last timestamp for an exchange
 * @param {string} exchange exchange name
 */
const getLastTS = async(exchange) => {
    const sql = `select "closeTime"
    from public."candle"
    where exchange = $1
    order by "closeTime" desc
    limit 1`;

    try {
        const res = await pool.query(sql, [exchange]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

/**
 * Add many candlesticks to the db
 * @param {Array} ticks ticks to add
 * @param {string} exchange exchange of tick
 * @param {string} symbol tick symbol
 */
const addMany = async(ticks, exchange, symbol) => {
    let promises = [];
    if(typeof ticks !== 'undefined' && ticks.length > 0) {
        ticks.forEach(tick => {
            promises.push(add(tick, exchange, symbol));
        });
        await Promise.all(promises);
    }
    // for await (const tick of ticks) {
    //     this.add(tick, exchange, symbol);
    // }
}

/**
 * Add a candlestick to the db
 * @param {object} tick tick to add
 * @param {string} exchange exchange of tick
 * @param {string} symbol tick symbol
 */
const add = async(tick, exchange, symbol) => {
    const sql = `INSERT INTO public."candle" ( exchange, symbol, open, high, low, close, volume, "closeTime", size )
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9 ) `;
    const data = [
        exchange,
        symbol, 
        tick.open, 
        tick.high, 
        tick.low, 
        tick.close, 
        tick.volume, 
        tick.closeTime,
        tick.size
    ];
    try {
        const res = await pool.query(sql, data);

        return res.rowCount;
    } catch(err) {
        console.log(err);
    }
}

module.exports = {
    get,
    getSymbol,
    getLastTS,
    add,
    addMany
}