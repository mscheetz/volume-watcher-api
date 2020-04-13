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

const get = async(exchange) => {
    const sql = `select symbol 
    from public."symbol"
    where exchange = $1;`;

    try {
        const res = await pool.query(sql, [exchange]);

        return res.rows;
    } catch(err) {
        console.log(err);
    }
}

const addMany = async(symbols, exchange) => {
    let promises = [];
    symbols.forEach(symb => {
        promises.push(add(symb, exchange));
    });
    await Promise.all(promises);
    // for await (const symbol of symbols) {
    //     this.add(symbol, exchange);
    // }
}

const add = async(symbol, exchange) => {
    const sql = `INSERT INTO public."symbol" ( symbol, exchange )
    VALUES ( $1, $2 ) `;

    try {
        const res = await pool.query(sql, [symbol, exchange]);

        return res.rowCount;
    } catch(err) {
        console.log(err);
    }
}

const removeMany = async(symbols, exchange) => {
    for await (const symbol of symbols) {
        this.remove(symbol, exchange);
    }
}

const remove = async(symbol, exchange) => {
    const sql = `DELETE public."symbol"
    WHERE symbol = $1 AND exchange = $2;`;

    try {
        const res = await pool.query(sql, [symbol, exchange]);

        return res.rowCount;
    } catch(err) {
        console.log(err);
    }
}

module.exports = {
    get,
    add,
    addMany,
    remove,
    removeMany
}