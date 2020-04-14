const express = require('express');
const router = express.Router();
const volumeRepo = require('../data/volume-watch.repo');
const volumeSvc = require('../services/volume.service');

router.use(async(req, res, next) =>{
    console.log('volume route called');
    next();
});

router.get('/exchanges', async(req, res, next) => {
    const exchanges = await volumeRepo.getExchanges();

    res.json(exchanges);
});

router.get('/symbols', async(req, res, next) => {
    const symbols = await volumeRepo.getAllSymbols();

    res.json(symbols);
});

router.get('/exchanges/:exchange', async(req, res, next) => {
    const exchange = req.params.exchange;
    const indicator = await volumeRepo.get(exchange);

    res.json(indicator);
});

router.get('/exchanges/:exchange/symbols', async(req, res, next) => {
    const exchange = req.params.exchange;
    const symbols = await volumeRepo.getSymbols(exchange);

    res.json(symbols);
});

router.get('/exchanges/:exchange/symbols/:symbol', async(req, res, next) => {
    const exchange = req.params.exchange;
    const symbols = req.params.symbol;
    const indicator = await volumeRepo.getDetail(exchange, symbol);

    res.json(indicator[0]);
});

router.get('/exchanges/:exchange/size/:size/percent/:percent/custom', async(req, res, next) => {
    const exchange = req.params.exchange;
    const size = req.params.size;
    const percent = req.params.percent;

    const indicators = await volumeSvc.customRun(exchange, size, percent);

    res.json(indicators);
});

module.exports = router;