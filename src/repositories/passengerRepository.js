const BaseRepository = require('./BaseRepository');
const Passenger = require('../models/Passenger');

class PassengerRepository extends BaseRepository {
    constructor() {
        super(Passenger);
    }

    async findByEmail(email) {
        return await this.model.findOne({ email }).select('+password');
    }
}

module.exports = new PassengerRepository();
