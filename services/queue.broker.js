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
        console.info(`Initializing rabbit queue`);
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
        console.info(`Sending message to ${queue}`);
        if(!this.connection) {
            await this.init();
        }
        try{
            await this.channel.assertQueue(queue, { durable: true, arguments: { 'x-expires': +config.QUEUE_EXPIRY } });
        } catch(err) {
            console.log(`Error asserting queue ${queue}`, err);
        }

        const buffer = Buffer.from(JSON.stringify(message));
        
        try {
            this.channel.sendToQueue(queue, buffer);
        } catch(err) {
            console.log(`Error sending to queue ${queue}`, err);
        }
    }

    /**
     * Subscribe to a queue
     * @param {string} queue queue name
     * @param {Function} callback function to run on message consume
     */
    async subscribe(queue, callback) {
        if(!this.connection) {
            await this.init();
        }
        try{
            await this.channel.assertQueue(queue, { durable: true, arguments: { 'x-expires': +config.QUEUE_EXPIRY } });
        } catch(err) {
            console.err(`Error asserting queue ${queue}`, err);
        }

        this.channel.consume(queue, callback, { noAck: true });
    }

    /**
     * Subscribe to a queue
     * @param {string} queue queue name
     * @param {Function} func function to run on message consume
     */
    async subscribeOld(queue, func) {
        if(!this.connection) {
            await this.init();
        }
        if(this.queues[queue]) {
            const handler = _.find(this.queues[queue], h => h === func);
            if(handler) {
                return () => this.unsubscribe(queue, handler);
            }
            this.queues[queue].push(func);
            return () => this.unsubscribe(queue, func);
        }

        await this.channel.assertQueue(queue, { durable: true, arguments: { 'x-expires': +config.QUEUE_EXPIRY } });
        this.queues[queue] = [func];
        this.channel.consume(queue, async(message) => {
            const ack = _.once(() => this.channel.ack(message));
            this.queues[queue].forEach(q => {
                q(message, ack);
            })
        });

        return () => this.unsubscribe(queue, func);
    }

    async unsubscribe(queue, func) {
        _.pull(this.queues[queue], func);
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