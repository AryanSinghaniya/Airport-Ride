const Passenger = require('../models/Passenger');
const passengerRepository = require('../repositories/passengerRepository');

const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();
    res.status(statusCode).json({
        success: true,
        token,
        data: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
};

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone, role, defaultTerminal, currentLocation } = req.body;

        const user = await passengerRepository.create({
            name,
            email,
            password,
            phone,
            role,
            defaultTerminal,
            currentLocation
        });

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: { message: 'Please provide an email and password' } });
        }

        const user = await passengerRepository.findByEmail(email);

        if (!user) {
            return res.status(401).json({ error: { message: 'Invalid credentials' } });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ error: { message: 'Invalid credentials' } });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};
