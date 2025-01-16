const bunyan = require('bunyan');

const logger = bunyan.createLogger({
    name: "almatools-api",
    streams: [{
        type: 'rotating-file',
        path: 'almatools-api.log',
        period: '1d',
        count: 3,
        level: process.env.LOG_LEVEL || 'info',
    }]
});

module.exports = logger;