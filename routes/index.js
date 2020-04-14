const router = require('express').Router();
const exchange = require('./exchange.route');
const volume = require('./volume.route');

router.use('/exchange', exchange);
router.use('/volume', volume);

module.exports = router;