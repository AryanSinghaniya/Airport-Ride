const express = require('express');
const authRoutes = require('./authRoutes');
const rideRoutes = require('./rideRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/rides', rideRoutes);
router.use('/pricing', rideRoutes); // Reusing for estimate

module.exports = router;
