const express = require('express');
const { requestRide, getPool, estimatePrice, getOpenPools, acceptRide, cancelRide } = require('../controllers/rideController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // All routes protected

router.post('/request', requestRide);
router.get('/open', getOpenPools);
router.get('/pool/:id', getPool);
router.get('/estimate', estimatePrice);
router.put('/pool/:id/accept', acceptRide);
router.post('/pool/:id/cancel', cancelRide);

module.exports = router;
