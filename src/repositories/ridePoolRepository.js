const BaseRepository = require('./BaseRepository');
const RidePool = require('../models/RidePool');

class RidePoolRepository extends BaseRepository {
    constructor() {
        super(RidePool);
    }

    async findNearbyOpenPools(longitude, latitude, terminal, maxDistance = 5000) {
        return await this.model.find({
            startLocation: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: maxDistance
                }
            },
            status: 'open',
            terminal: terminal
            // seatsRemaining handled in memory or additional query filter if index supports
        });
    }

    async findOpenPoolsByTerminal(terminal) {
        return await this.model.find({
            status: 'open',
            terminal: terminal,
            seatsRemaining: { $gt: 0 }
        });
    }
}

module.exports = new RidePoolRepository();
