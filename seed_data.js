const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Passenger = require('./src/models/Passenger');
const RidePool = require('./src/models/RidePool');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const seedData = async () => {
    await connectDB();

    try {
        await Passenger.deleteMany();
        await RidePool.deleteMany();
        console.log('Old Data destroyed...');

        const users = [
            {
                name: 'Alice Driver',
                email: 'alice@driver.com',
                password: 'password123',
                phone: '9876543210',
                role: 'driver',
                currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716] }
            },
            {
                name: 'Bob Passenger',
                email: 'bob@passenger.com',
                password: 'password123',
                phone: '1234567890',
                role: 'passenger',
                currentLocation: { type: 'Point', coordinates: [77.6, 12.9] }
            },
            {
                name: 'Charlie Passenger',
                email: 'charlie@passenger.com',
                password: 'password123',
                phone: '1122334455',
                role: 'passenger',
                currentLocation: { type: 'Point', coordinates: [77.5, 12.8] }
            }
        ];

        for (const user of users) {
            await Passenger.create(user);
        }

        console.log('Data Imported Successfully!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
