const express = require('express');
const router = express.Router();

router.use(async(req, res, next) =>{
    console.log('exchange router called');
    next();
});

router.get('/', async(req, res, next) => {
    const exchanges = [ "BINANCE" ];

    res.json(exchanges);
});

router.get('/intervals', async(req, res, next) => {
    const intervals = [ "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M" ];

    res.json(intervals);
})

module.exports = router;