const Queue = require('bull');
const poolingService = require('../services/poolingService');
const logger = require('../config/logger');

const rideQueue = new Queue('ride-matching', {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

rideQueue.process(async (job) => {
    const { passenger, requestData } = job.data;

    logger.info(`Processing ride match for passenger ${passenger._id || passenger.id} (Job ${job.id})`);

    try {
        const result = await poolingService.matchPassengerToPool(passenger, requestData);

        // Notify User via Socket.IO
        if (global.io) {
            // User ID might be inside _id or id depending on how it was passed
            const userId = passenger._id || passenger.id;
            global.io.to(`user_${userId}`).emit('rideMatched', {
                success: true,
                _id: result.pool._id,
                status: result.pool.status,
                poolId: result.pool._id, // keeping for backward compat if needed
                isNewPool: result.isNew,
                message: 'Ride pool found!'
            });
            logger.info(`Emitted rideMatched to user_${userId}`);
        }

        return result;
    } catch (err) {
        logger.error(`Ride matching failed for job ${job.id}: ${err.message}`);
        if (global.io) {
            const userId = passenger._id || passenger.id;
            global.io.to(`user_${userId}`).emit('rideError', {
                message: 'Failed to find a ride pool. Please try again.'
            });
        }
        throw err;
    }
});

module.exports = rideQueue;
