const mongoose = require('mongoose');

const pricingLogSchema = new mongoose.Schema({
    ridePoolId: {
        type: mongoose.Schema.ObjectId,
        ref: 'RidePool'
    },
    baseFare: Number,
    distanceValues: [Number], // Distances for each passenger
    surgeMultiplier: {
        type: Number,
        default: 1.0
    },
    totalFare: Number,
    calculatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PricingLog', pricingLogSchema);
