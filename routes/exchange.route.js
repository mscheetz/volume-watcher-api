const express = require('express');
const router = express.Router();
const repo = require('../data/binance-candle.repo');
const enums = require('../classes/enums');

router.use(async(req, res, next) =>{
    console.log('router called');
    next();
});

router.get('/', async(req, res, next) => {
    let levels = await repo.getAll();

    levels = attributeMatch(levels);

    res.json(levels);
});