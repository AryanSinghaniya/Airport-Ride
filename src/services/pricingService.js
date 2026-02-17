class PricingService {
    constructor() {
        this.baseRatePerKm = 2.0;
        this.baseFare = 5.0; // Startup fee
    }

    // Simple Haversine distance
    calculateDistance(coords1, coords2) {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371; // Earth radius km

        const dLat = toRad(coords2[1] - coords1[1]);
        const dLon = toRad(coords2[0] - coords1[0]);
        const lat1 = toRad(coords1[1]);
        const lat2 = toRad(coords2[1]);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    calculateFare(distanceKm, surgeMultiplier = 1.0, passengersCount = 1) {
        let fare = (this.baseFare + (distanceKm * this.baseRatePerKm)) * surgeMultiplier;

        // Seat sharing discount
        if (passengersCount > 1) {
            fare = fare * 0.8; // 20% discount for pooling
        }

        return Math.round(fare * 100) / 100;
    }

    getSurgeMultiplier(demand, supply) {
        if (supply === 0) return 2.0;
        const ratio = demand / supply;
        if (ratio > 2) return 1.5;
        if (ratio > 1.5) return 1.25;
        return 1.0;
    }
}

module.exports = new PricingService();
