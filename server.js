const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const cron = require('node-cron');
const binanceSvc = require('./services/binance.service');
const routes = require('./routes/index');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(compression());
app.use(cors());
app.use(helmet());

app.get('/', (req, res) => res.send('Hello World!'))
app.use('/api', routes);

cron.schedule('0 * * * *', () => {
    console.log(`Running hourly volume check at: ${new Date}`);
    binanceSvc.runCheck();
});
console.log(`Running at ${new Date}`)
binanceSvc.runCheck();

app.listen(port, () => console.log(`App listening at port ${port}`))