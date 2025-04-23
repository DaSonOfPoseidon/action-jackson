const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// Get all services
router.get('/services', async (req, res) => {
    try {
        const services = await Service.find({});
        res.json(services);
    } catch (error) {
        res.status(500).send('Error fetching services');
    }
});

module.exports = router;