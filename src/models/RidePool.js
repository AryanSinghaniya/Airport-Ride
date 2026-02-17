const mongoose = require('mongoose');

const ridePoolSchema = new mongoose.Schema({
    passengers: [{
        passengerId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Passenger',
            required: true
        },
        pickupLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number]
        },
        dropoffLocation: { // Usually the airport terminal location
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number]
        },
        terminal: String,
        luggageCount: Number,
        seatsNeeded: { type: Number, default: 1 },
        fare: Number
    }],
    status: {
        type: String,
        enum: ['open', 'locked', 'in-progress', 'completed', 'cancelled'],
        default: 'open',
        index: true
    },
    driver: {
        type: mongoose.Schema.ObjectId,
        ref: 'Passenger' // Drivers are also Users/Passengers in this system currently
    },
    startLocation: { // Centroid or first passenger pickup
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
            type: [Number],
            index: '2dsphere'
        }
    },
    terminal: {
        type: String,
        required: true,
        index: true
    },
    route: {
        type: { type: String, enum: ['LineString'] },
        coordinates: [[Number]] // Array of points
    },
    totalSeats: {
        type: Number,
        default: 4
    },
    seatsRemaining: {
        type: Number,
        default: 4
    },
    luggageCapacity: {
        type: Number,
        default: 4 // e.g., 4 pieces of luggage max
    },
    luggageRemaining: {
        type: Number,
        default: 4
    },
    startTime: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 * 24 // TTL 24 hours
    }
});

// Compound index for querying open pools near a location
ridePoolSchema.index({ startLocation: '2dsphere', status: 1, seatsRemaining: 1 });

module.exports = mongoose.model('RidePool', ridePoolSchema);
