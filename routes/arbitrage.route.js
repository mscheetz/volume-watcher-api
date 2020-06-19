const express = require('express');
const router = express.Router();
const volumeRepo = require('../data/volume-watch.repo');
const volumeSvc = require('../services/volume.service');

router.use(async(req, res, next) =>{
    console.log('arbitrage route called');
    next();
});

router.get('', async(req, res, next) => {
    const paths = await volumeSvc.getArbitrage();

    res.json(paths);
});

module.exports = router;