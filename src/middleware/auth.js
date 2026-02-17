const jwt = require('jsonwebtoken');
const Passenger = require('../models/Passenger');
const logger = require('../config/logger');

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: { message: 'Not authorized to access this route' } });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await Passenger.findById(decoded.id);
        next();
    } catch (err) {
        logger.error(`Auth Error: ${err.message}`);
        return res.status(401).json({ error: { message: 'Not authorized to access this route' } });
    }
};
