const router = require('express').Router();
const exchange = require('./exchange.route');
const volume = require('./volume.route');
const voa = require('./volume-over-average.route');

router.use('/exchange', exchange);
router.use('/volume', volume);
router.use('/voa', voa);

module.exports = router;