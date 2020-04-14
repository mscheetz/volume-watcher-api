const amqp = require('amqplib');
const config = require('../config');

/**
 * @var {Promise<QueueBroker>}
 */
let instance;

class QueueBroker {

    constructor() {
        this.queues = {};
    }

    /**
     * Initialize a queue
     * @returns new instance of QueueBroker
     */
    async init(){ 
        this.connection = await amqp.connect(config.AMQPURL);
        this.channel = await this.connection.createChannel();
        return this;
    }

    /**
     * Send a message to a queue
     * @param {string} queue queue name
     * @param {object} message message to send to queue
     */
    async send(queue, message) {
        if(!this.connection) {
            await this.init();
        }
        await this.channel.assertQueue(queue, { durable: true, arguments: { 'x-expires': config.QUEUE_EXPIRY } });
        let buffer = Buffer.from(JSON.stringify(message));

        this.channel.sendToQueue(queue, buffer);
    }
}

/**
 * @returns {Promise<QueueBroker>}
 */
QueueBroker.getInstance = async() => {
    if(!instance) {
        const broker = new QueueBroker();
        instance = broker.init();
    }
    return instance;
}

module.exports = QueueBroker;