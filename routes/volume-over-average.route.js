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

router.post('', async(req, res, next) => {
    const page = req.body.page | 0;
    const size = req.body.size | 25;
    const totalRes = await repo.getCount();
    const total = +totalRes.count;
    const pages = Math.ceil(total / size);
    let results = [];
    if(page <= pages) {
        let offset = page === 0 ? 0 : (page * size);

        results = await repo.getPaged(size, offset);
    }
    const response = {
        data: results,
        total: total,
        pages: pages,
        page: page,
        size: size
    };

    res.json(response);
});

module.exports = router;