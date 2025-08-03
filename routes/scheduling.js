const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');

/*
TODO
- Add validation for date and time inputs
- Implement user authentication for booking
- Add email confirmation for scheduled appointments
- Implement cancellation of appointments
- Add quote validation from database via quoteID
*/

// Get available time slots
router.get('/slots', async (req, res) => {
    try {
        const slots = await Schedule.find({});
        res.json(slots);
    } catch (error) {
        res.status(500).send('Error fetching available slots');
    }
});

// Create a new schedule entry
router.post('/book', async (req, res) => {
    const { name, email, date, time } = req.body;
    try {
        const newSchedule = new Schedule({ name, email, date, time });
        await newSchedule.save();
        res.status(201).send('Appointment scheduled successfully');
    } catch (error) {
        res.status(500).send('Error scheduling appointment');
    }
});

module.exports = router;