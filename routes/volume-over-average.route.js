const express = require('express');
const router = express.Router();
const repo = require('../data/volume-increase.repo');

router.use(async(req, res, next) =>{
    console.log('volume over average route called');
    next();
});

router.get('', async(req, res, next) => {
    const averages = await repo.get();

    res.json(averages);
});

module.exports = router;