const RidePool = require('../models/RidePool');
const ridePoolRepository = require('../repositories/ridePoolRepository');
const redisClient = require('../config/redis');
const pricingService = require('./pricingService');
const logger = require('../config/logger');

class PoolingService {
    constructor() {
        this.lockTTL = 2000; // 2 seconds lock
    }

    async acquireLock(resourceId) {
        const key = `lock:pool:${resourceId}`;
        // Simple Redis locking mechanism
        const result = await redisClient.set(key, 'locked', 'PX', this.lockTTL, 'NX');
        return result === 'OK';
    }

    async releaseLock(resourceId) {
        const key = `lock:pool:${resourceId}`;
        await redisClient.del(key);
    }

    async matchPassengerToPool(passenger, requestData) {
        const { pickupLocation, terminal, luggageCount, seatsNeeded } = requestData;
        const [lon, lat] = pickupLocation.coordinates;

        // 1. Find nearby open pools going to the same terminal
        const nearbyPools = await ridePoolRepository.findNearbyOpenPools(lon, lat, terminal);

        for (const pool of nearbyPools) {
            // 2. Check Constraints (Seats, Luggage)
            if (pool.seatsRemaining >= seatsNeeded && pool.luggageRemaining >= luggageCount) {

                // 3. Concurrency Control: Try to lock the pool
                const isLocked = await this.acquireLock(pool._id);
                if (!isLocked) {
                    logger.warn(`Pool ${pool._id} is locked, skipping...`);
                    continue; // Try next pool
                }

                try {
                    // Double check state after acquiring lock (Optimistic Locking pattern essentially)
                    const currentPool = await ridePoolRepository.findById(pool._id);
                    if (
                        !currentPool ||
                        currentPool.status !== 'open' ||
                        currentPool.seatsRemaining < seatsNeeded
                    ) {
                        logger.warn(`Pool ${pool._id} state changed, skipping...`);
                        continue;
                    }

                    // 4. Add Passenger to Pool
                    // calculate detour: distance from start -> new pickup -> terminal
                    // This is a naive heuristic. Real world would use OSRM/Google Maps Matrix API
                    // Distance from Pool Start -> New Pickup
                    const distToPickup = pricingService.calculateDistance(currentPool.startLocation.coordinates, pickupLocation.coordinates);
                    
                    // Distance from New Pickup -> Terminal (Destination)
                    // Assuming all pools go to a specific Terminal location. 
                    // Let's assume Terminal coordinates distinct for each pool in a real app, 
                    // but here we can approx using the Passenger's intended terminal location if needed.
                    // For now, let's use the pool's route start to approximate direction.
                    
                    // Constraint: Pickup must be within reasonable range of start (e.g. 5km)
                    // AND New Passenger is roughly on the way (Angle check could be better, but distance heuristic is okay for this scope)
                    
                    if (distToPickup > 5) {
                        continue;
                    }
                    
                    // Constraint: Max Detour Tolerance
                    // Ensure adding this passenger doesn't add more than X mins/km to others? 
                    // Simplified: We just ensure they are close to start. 
                    // Let's add a "Max Stops" check or similar if needed.

                    const fare = pricingService.calculateFare(10, 1.2, currentPool.passengers.length + 1); // Mock distance/surge

                        currentPool.passengers.push({
                        passengerId: passenger._id,
                        pickupLocation,
                        terminal,
                        luggageCount,
                        seatsNeeded: seatsNeeded,
                        fare
                    });

                    currentPool.seatsRemaining -= seatsNeeded;
                    currentPool.luggageRemaining -= luggageCount;

                    if (currentPool.seatsRemaining === 0) {
                        currentPool.status = 'locked'; // Full
                    }

                    await currentPool.save();
                    logger.info(`Passenger ${passenger._id} added to pool ${currentPool._id}`);

                    return { pool: currentPool, isNew: false };

                } catch (err) {
                    logger.error(`Error updating pool ${pool._id}: ${err.message}`);
                    throw err;
                } finally {
                    await this.releaseLock(pool._id);
                }
            }
        }

        // 5. No pool found: Create new Pool
        const newPool = await ridePoolRepository.create({
            startLocation: pickupLocation,
            terminal,
            passengers: [{
                passengerId: passenger._id,
                pickupLocation,
                terminal,
                luggageCount,
                fare: pricingService.calculateFare(10, 1.0, 1) // Base fare estimate
            }],
            seatsRemaining: 4 - seatsNeeded,
            luggageRemaining: 4 - luggageCount,
            status: 'open'
        });

        logger.info(`Created new pool ${newPool._id} for passenger ${passenger._id}`);
        return { pool: newPool, isNew: true };
    }
}

module.exports = new PoolingService();
