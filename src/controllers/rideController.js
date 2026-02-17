const poolingService = require('../services/poolingService');
const pricingService = require('../services/pricingService');
const RidePool = require('../models/RidePool');
const logger = require('../config/logger');

// We will add Queue producer here later in the worker step or keep it direct for now to test.
// For the assignment "Async Processing" requirement, we should ideally push to queue.
const Queue = require('bull');
const rideQueue = new Queue('ride-matching', {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        maxRetriesPerRequest: null
    }
});

exports.requestRide = async (req, res, next) => {
    try {
        const { pickupLocation, terminal, luggageCount, seatsNeeded } = req.body;

        // Validate inputs (Joi validation middleware should ideally handle this)
        if (!pickupLocation || !pickupLocation.coordinates || !terminal) {
            return res.status(400).json({ error: { message: 'Invalid request data' } });
        }

        logger.info(`Received ride request from ${req.user.name}`);

        // Push to Queue for Async Processing
        const job = await rideQueue.add({
            passenger: req.user, // sending full user object or just ID
            requestData: req.body
        });

        res.status(202).json({
            success: true,
            message: 'Ride request received and processing.',
            jobId: job.id
        });

    } catch (err) {
        next(err);
    }
};

exports.getPool = async (req, res, next) => {
    try {
        const pool = await RidePool.findById(req.params.id).populate('passengers.passengerId', 'name phone');
        if (!pool) {
            return res.status(404).json({ error: { message: 'Pool not found' } });
        }
        res.status(200).json({ success: true, data: pool });
    } catch (err) {
        next(err);
    }
};

exports.estimatePrice = async (req, res, next) => {
    // Implementation for price estimation endpoint
    try {
        const { distance, seats } = req.query;
        if (!distance) return res.status(400).json({ error: { message: 'Distance is required' } });

        const fare = pricingService.calculateFare(Number(distance), 1.0, seats ? Number(seats) : 1);
        res.status(200).json({ success: true, fare });
    } catch (err) {
        next(err);
    }
};

exports.getOpenPools = async (req, res, next) => {
    try {
        const pools = await RidePool.find({ status: 'open' }).populate('passengers.passengerId', 'name phone');
        res.status(200).json({ success: true, count: pools.length, data: pools });
    } catch (err) {
        next(err);
    }
};

exports.acceptRide = async (req, res, next) => {
    try {
        const pool = await RidePool.findById(req.params.id);

        if (!pool) {
            return res.status(404).json({ error: { message: 'Ride not found' } });
        }

        if (pool.status !== 'open') {
            return res.status(400).json({ error: { message: 'Ride is no longer available' } });
        }

        pool.driver = req.user.id;
        pool.status = 'in-progress';
        await pool.save();

        // Notify all passengers in the pool
        if (global.io) {
            pool.passengers.forEach(p => {
                // passengerId might be an object if populated, or string if not.
                // In this controller, we found by ID but didn't populate for the logic, 
                // but checking just in case or assuming ID.
                // Actually RidePool.findById(req.params.id) is used above without populate.
                const pId = p.passengerId.toString();
                global.io.to(`user_${pId}`).emit('rideAccepted', {
                    success: true,
                    poolId: pool._id,
                    driver: {
                        name: req.user.name,
                        phone: req.user.phone
                    },
                    message: 'Driver accepted your ride!'
                });
                logger.info(`Emitted rideAccepted to user_${pId}`);
            });
        }

        res.status(200).json({ success: true, data: pool });
    } catch (err) {
        next(err);
    }
};

exports.cancelRide = async (req, res, next) => {
    try {
        const pool = await RidePool.findById(req.params.id);

        if (!pool) {
            return res.status(404).json({ error: { message: 'Ride not found' } });
        }

        // Check if user is the one who requested (compare string IDs for consistency)
        const userId = (req.user._id || req.user.id).toString();
        const passengerIndex = pool.passengers.findIndex(p => p.passengerId.toString() === userId);
        if (passengerIndex === -1) {
            return res.status(403).json({ error: { message: 'Not authorized to cancel this ride' } });
        }

        if (pool.status === 'open' || pool.status === 'locked' || pool.status === 'in-progress' || pool.status === 'completed') {
            const passenger = pool.passengers[passengerIndex];
            
            // Only refund/cancel if not started or completed (unless specific refund policy)
            if (pool.status === 'completed') {
                 return res.status(400).json({ error: { message: 'Cannot cancel completed ride' } });
            }

            // Restore seats and luggage capacity
            const seatsToRestore = passenger.seatsNeeded || 1;
            pool.seatsRemaining = Math.min(pool.totalSeats, pool.seatsRemaining + seatsToRestore);
            pool.luggageRemaining = Math.min(pool.luggageCapacity, pool.luggageRemaining + (passenger.luggageCount || 0));

            // Remove passenger
            pool.passengers.splice(passengerIndex, 1);

            // If pool becomes empty, reset state if desired to 'open' (if not already completed/cancelled)
            if (pool.passengers.length === 0) {
                 if (pool.status !== 'completed' && pool.status !== 'cancelled') {
                     pool.status = 'open';
                 }
            } else if (pool.status === 'locked' && pool.seatsRemaining > 0) {
                 // If was locked (full), but someone left, reopen?
                 pool.status = 'open';
            }

            await pool.save();
            return res.status(200).json({ success: true, message: 'Ride cancelled successfully' });
        }

        res.status(400).json({ error: { message: 'Cannot cancel ride in current status' } });

    } catch (err) {
        next(err);
    }
};
