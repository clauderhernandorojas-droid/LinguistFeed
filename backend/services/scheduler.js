/**
 * Re-export schedulerService to maintain compatibility with references to 'services/scheduler'
 */
const schedulerService = require('./schedulerService');

module.exports = schedulerService;
