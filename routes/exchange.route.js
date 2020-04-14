const express = require('express');
const router = express.Router();
const candleRepo = require('../data/candle.repo');

router.use(async(req, res, next) =>{
    console.log('router called');
    next();
});

router.get('/', async(req, res, next) => {
    const message = "hello world from this api endpoint";

    res.json(message);
});

module.exports = router;