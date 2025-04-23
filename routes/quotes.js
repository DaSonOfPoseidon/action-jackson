const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const nodemailer = require('nodemailer');
const os = require('os');

// Get client IP address
const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
};

// Create a new quote and email admin
router.post('/create', async (req, res) => {
    const { serviceType, drops, construction, atticCrawl } = req.body;
    const clientIP = getClientIP(req);

    try {
        const newQuote = new Quote({
            serviceType,
            drops,
            construction,
            atticCrawl,
            ip: clientIP
        });

        await newQuote.save();

        // Send notification email to admin
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: 'New Quote Submission',
            text: `A new quote has been submitted:
Service: ${serviceType}
Drops: ${drops}
Construction: ${construction ? 'Yes' : 'No'}
Attic/Crawl Space: ${atticCrawl ? 'Yes' : 'No'}
IP Address: ${clientIP}`
        };

        await transporter.sendMail(mailOptions);
        res.status(201).send('Quote generated and email sent successfully');
    } catch (error) {
        res.status(500).send('Error generating quote');
    }
});

module.exports = router;
