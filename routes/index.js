const router = require('express').Router();
const arbitrage = require('./arbitrage.route');
const exchange = require('./exchange.route');
const volume = require('./volume.route');
const voa = require('./volume-over-average.route');

router.use('/arbitrage', arbitrage);
router.use('/exchange', exchange);
router.use('/volume', volume);
router.use('/voa', voa);

module.exports = router;