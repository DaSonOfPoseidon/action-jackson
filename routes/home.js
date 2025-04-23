const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Testimonial = require('../models/Testimonial');

// Get homepage content dynamically
router.get('/', async (req, res) => {
    try {
        const services = await Service.find({});
        const testimonials = await Testimonial.find({});
        res.json({ services, testimonials });
    } catch (error) {
        res.status(500).send('Error fetching homepage content');
    }
});

module.exports = router;
