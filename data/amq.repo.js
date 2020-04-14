const amqp = require('amqplib/callback_api');
const config = require('../config');
let amqpConn = null, channel = null;

const createConnection = async() => {
    amqp.connect(config.AMQPURL, function(err, conn) {
        if(err){
            console.err(err)
        }
        amqpConn = conn;
    });
}

const createChannel = async() => {
    amqpConn.createChannel(function(err, chan) {
        if(err) {
            console.err(err);
        }
        channel = chan;
    });
}

const sendToQueue = async(queueName, message) =>{
    if(amqpConn === null) {
        await createConnection();
    }
    if(channel === null) {
        await createChannel();
    }

    channel.assertQueue(queueName, {durable: false});

    channel.sendToQueue(queueName, Buffer.from(message));

    console.info(`message sent to ${queueName}`);
}

module.exports = {
    sendToQueue
}