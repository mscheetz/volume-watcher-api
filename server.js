const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const cron = require('node-cron');
const binanceSvc = require('./services/binance.service');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(compression());
app.use(cors());
app.use(helmet());

cron.schedule('*/5 * * * *', () => {
    console.log('Running volume check');
});

//binanceSvc.symbolCheck();
binanceSvc.stickCheck();

app.listen(port, () => console.log(`App listening at port ${port}`))