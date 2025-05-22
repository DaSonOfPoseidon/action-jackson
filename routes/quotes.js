const express    = require('express');
const router     = express.Router();
const Quote      = require('../models/Quote');
const nodemailer = require('nodemailer');

// Helper to grab real client IP (works behind proxies)
const getClientIP = req =>
  req.headers['x-forwarded-for'] ||
  req.socket.remoteAddress ||
  null;

router.post('/create', async (req, res) => {
  const { customer, packageOption, discount, runs, services } = req.body;
  const clientIP = getClientIP(req);

  // Basic validation
  if (!customer?.name || !customer?.email || !packageOption) {
    return res.status(400).json({ error: 'Missing customer name, email or package.' });
  }

  try {
    // 1) Save to Mongo
    const newQuote = new Quote({
      customer,
      packageOption,
      discount,
      runs,
      services,
      ip: clientIP
    });
    await newQuote.save();

    // 2) Notify admin by email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailLines = [
      `New Quote Submission`,
      `--------------------`,
      `Name: ${customer.name}`,
      `Email: ${customer.email}`,
      `Package: ${packageOption}`,
      `Discount: ${discount}%`,
      `Coax runs: ${runs.coax}`,
      `Cat6 runs: ${runs.cat6}`,
      `Device mounts: ${services.deviceMount}`,
      `Network setups: ${services.networkSetup}`,
      `Media panels: ${services.mediaPanel}`,
      `IP Address: ${clientIP}`
    ];

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:   process.env.ADMIN_EMAIL,
      subject: '📄 New Quote Submitted',
      text:     mailLines.join('\n')
    });

    // 3) Respond to frontend
    res.status(201).json({ id: newQuote._id });
  } catch (err) {
    console.error('Quote create error:', err);
    res.status(500).json({ error: 'Error generating quote' });
  }
});

module.exports = router;