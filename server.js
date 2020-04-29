const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const cron = require('node-cron');
const volumeSvc = require('./services/volume.service');
const routes = require('./routes/index');
const app = express();
const http = require('http');
const server = http.createServer(app);
const socketio = require('socket.io');
const io = socketio.listen(server);
//const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

const whitelistOrigins = [
    'http://localhost:4200',
    'https://volume-watcher.herokuapp.com/'
    ];

const corsOptions = {
    origin: function(origin, callback) {
        let isWhitelisted = whitelistOrigins.indexOf(origin) !== -1;
        callback(null, isWhitelisted);
    },
    optionsSuccessStatus: 200
};
// const corsOptions = {
//     origin: whitelistOrigins[1],
//     optionsSuccessStatus: 200
// };

app.set('socketio', io);
app.set('server', server);

app.use(bodyParser.json());
app.use(compression());
app.use(cors(corsOptions));
app.use(helmet());
app.use(async(req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/', (req, res) => res.send('Hello World!'))
app.use('/api', routes);

io.serveClient('origins', 'https://volume-watcher.herokuapp.com');

io.on('connection', (socket) => {
    socket.on('custom sent', (queueId) => {
        if(typeof queueId !== 'undefined') {
            console.log(`new request for ${queueId}`);
            volumeSvc.queueProcessor(queueId, 'volumes', socket);
        }
    })
})

cron.schedule('01 * * * *', () => {
    console.log(`Running hourly volume check at: ${new Date}`);
    volumeSvc.runVolumeCheck();
});

cron.schedule('20 0 * * *', () => {
    console.log(`Running 1d, 3d, 1w overage check at: ${new Date}`);
    volumeSvc.runOverageCheck();
});

// volumeSvc.runVolumeCheck();
// volumeSvc.runOverageCheck();

app.get('server')
   .listen(port, () => {
       console.log(`App started at ${new Date}. App listening at port ${port}`)
    });