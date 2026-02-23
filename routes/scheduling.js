const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const Quote = require('../models/Quote');
const rateLimit = require('express-rate-limit');
const { body, validationResult, query } = require('express-validator');
const validator = require('validator');
const nodemailer = require('nodemailer');

// Rate limiting for scheduling operations
const schedulingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 scheduling requests per windowMs
  message: {
    error: 'Too many scheduling requests from this IP, please try again later.'
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Apply rate limiting
router.use(schedulingRateLimit);

// Email configuration for confirmations
const createEmailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured - appointment confirmations disabled');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Duration defaults by appointment type
const getDurationForType = (appointmentType, bodyDuration) => {
  if (appointmentType === 'survey') return 120;
  if (appointmentType === 'whole-home-install') return 720;
  // drops-only-install: use frontend-supplied duration or default to 120
  if (bodyDuration && Number.isFinite(bodyDuration) && bodyDuration >= 60 && bodyDuration <= 720) {
    return Math.ceil(bodyDuration / 60) * 60; // round up to nearest hour
  }
  return 120;
};

// Helper function to check for scheduling conflicts (duration-aware)
const checkSchedulingConflict = async (date, time, appointmentType, duration, excludeId = null) => {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  // Whole-home installs block the entire day
  if (appointmentType === 'whole-home-install') {
    const query = {
      date: {
        $gte: new Date(dateStr + 'T00:00:00.000Z'),
        $lt: new Date(dateStr + 'T23:59:59.999Z')
      }
    };
    if (excludeId) query._id = { $ne: excludeId };
    const conflict = await Schedule.findOne(query);
    return conflict;
  }

  // For non-whole-home: check if any whole-home install exists on that day
  const wholeHomeQuery = {
    date: {
      $gte: new Date(dateStr + 'T00:00:00.000Z'),
      $lt: new Date(dateStr + 'T23:59:59.999Z')
    },
    appointmentType: 'whole-home-install'
  };
  if (excludeId) wholeHomeQuery._id = { $ne: excludeId };
  const wholeHomeConflict = await Schedule.findOne(wholeHomeQuery);
  if (wholeHomeConflict) return wholeHomeConflict;

  // Time-range overlap check for survey / drops-only-install
  const [hours, minutes] = time.split(':').map(Number);
  const newStartMin = hours * 60 + minutes;
  const newEndMin = newStartMin + (duration || 120);

  // Get all non-cancelled appointments on this date
  const dayAppointments = await Schedule.find({
    date: {
      $gte: new Date(dateStr + 'T00:00:00.000Z'),
      $lt: new Date(dateStr + 'T23:59:59.999Z')
    },
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });

  for (const apt of dayAppointments) {
    const [aH, aM] = apt.time.split(':').map(Number);
    const aptStartMin = aH * 60 + aM;
    // Backward compat: old docs without duration treated as 60 min
    const aptDuration = apt.duration || 60;
    const aptEndMin = aptStartMin + aptDuration;

    // Overlap: newStart < aptEnd AND newEnd > aptStart
    if (newStartMin < aptEndMin && newEndMin > aptStartMin) {
      return apt;
    }
  }

  return null;
};

// Validation middleware for booking
const validateBooking = [
  body('quoteNumber')
    .trim()
    .isLength({ min: 8, max: 8 })
    .withMessage('Quote number must be exactly 8 digits')
    .matches(/^\d{8}$/)
    .withMessage('Quote number must contain only digits')
    .custom(async (quoteNumber) => {
      const quote = await Quote.findOne({ quoteNumber });
      if (!quote) {
        throw new Error('Quote number not found. Please verify your quote number.');
      }
      return true;
    }),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, apostrophes, and hyphens'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required')
    .custom((email) => {
      // Block disposable email domains
      const disposableDomains = [
        '10minutemail.com', 'mailinator.com', 'guerrillamail.com',
        'tempmail.org', 'temp-mail.org', '0-mail.com'
      ];
      
      const domain = email.split('@')[1]?.toLowerCase();
      
      // Allow example.com for testing
      if (process.env.NODE_ENV === 'test' && domain === 'example.com') {
        return true;
      }
      
      if (disposableDomains.includes(domain)) {
        throw new Error('Please use a valid business email address');
      }
      return true;
    }),
  body('date')
    .isISO8601()
    .withMessage('Valid date is required (YYYY-MM-DD format)')
    .custom((dateStr) => {
      const appointmentDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        throw new Error('Appointment date cannot be in the past');
      }
      
      // Don't allow appointments more than 90 days in advance
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + 90);
      
      if (appointmentDate > maxFutureDate) {
        throw new Error('Appointments can only be scheduled up to 90 days in advance');
      }
      
      return true;
    }),
  body('time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time is required (HH:MM format)')
    .custom((timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      // Business hours: 8 AM to 6 PM
      if (hours < 8 || hours > 18 || (hours === 18 && minutes > 0)) {
        throw new Error('Appointments are only available between 8:00 AM and 6:00 PM');
      }
      
      // Only allow appointments at hourly intervals
      if (minutes !== 0) {
        throw new Error('Appointments must be scheduled at hourly intervals (e.g., 9:00, 10:00)');
      }
      
      return true;
    }),
  body('appointmentType')
    .optional()
    .isIn(['survey', 'drops-only-install', 'whole-home-install'])
    .withMessage('Invalid appointment type'),
  body('duration')
    .optional()
    .isInt({ min: 60, max: 720 })
    .withMessage('Duration must be between 60 and 720 minutes'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
    .trim()
];

// Validate quote number and get quote details
router.get('/validate-quote/:quoteNumber', async (req, res) => {
  try {
    const { quoteNumber } = req.params;
    
    // Validate quote number format
    if (!/^\d{8}$/.test(quoteNumber)) {
      return res.status(400).json({ 
        error: 'Invalid quote number format. Quote number must be 8 digits.' 
      });
    }

    // Find the quote
    const quote = await Quote.findOne({ quoteNumber }).select('quoteNumber customer packageOption includeSurvey createdAt');
    
    if (!quote) {
      return res.status(404).json({ 
        error: 'Quote not found. Please verify your quote number.' 
      });
    }

    // Check if already scheduled
    const existingAppointment = await Schedule.findOne({ quoteNumber });
    
    if (existingAppointment) {
      return res.status(409).json({
        error: 'This quote already has an appointment scheduled.',
        appointment: {
          date: existingAppointment.date.toISOString().split('T')[0],
          time: existingAppointment.time
        }
      });
    }

    res.json({
      valid: true,
      quote: {
        quoteNumber: quote.quoteNumber,
        customerName: quote.customer.name,
        customerEmail: quote.customer.email,
        packageOption: quote.packageOption,
        includeSurvey: quote.includeSurvey,
        createdAt: quote.createdAt
      }
    });
  } catch (error) {
    console.error('Error validating quote:', error);
    res.status(500).json({ error: 'Error validating quote' });
  }
});

// Get available time slots for a specific date
router.get('/slots', [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in YYYY-MM-DD format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array().map(err => err.msg)
      });
    }

    const requestedDate = req.query.date;
    
    if (requestedDate) {
      // Return booked slots for specific date
      const bookedSlots = await Schedule.find({
        date: {
          $gte: new Date(requestedDate + 'T00:00:00.000Z'),
          $lt: new Date(requestedDate + 'T23:59:59.999Z')
        }
      }).select('time name appointmentType duration');

      res.json({
        date: requestedDate,
        bookedSlots: bookedSlots.map(slot => ({
          time: slot.time,
          customerName: slot.name?.split(' ')[0], // Only first name for privacy
          appointmentType: slot.appointmentType || 'drops-only-install',
          duration: slot.duration || 60
        }))
      });
    } else {
      // Return upcoming appointments (next 30 days)
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 30);
      
      const upcomingAppointments = await Schedule.find({
        date: {
          $gte: today,
          $lte: futureDate
        }
      }).sort({ date: 1, time: 1 }).select('date time name');
      
      res.json({
        upcomingAppointments: upcomingAppointments.map(apt => ({
          date: apt.date.toISOString().split('T')[0],
          time: apt.time,
          customerName: apt.name?.split(' ')[0] // Only first name for privacy
        }))
      });
    }
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Error fetching available slots' });
  }
});

// Create a new schedule entry
router.post('/book', validateBooking, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => err.msg)
    });
  }

  const { quoteNumber, name, email, date, time, phone, notes, appointmentType: reqAppointmentType, duration: reqDuration } = req.body;

  try {
    // Fetch the quote to get customer details and verify ownership
    const quote = await Quote.findOne({ quoteNumber });
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Verify email matches the quote (security check)
    if (quote.customer.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ 
        error: 'Email does not match the quote. Please use the same email address used for the quote.' 
      });
    }

    // Check if this quote already has an appointment scheduled
    const existingAppointment = await Schedule.findOne({ quoteNumber });
    if (existingAppointment) {
      return res.status(409).json({
        error: 'This quote already has an appointment scheduled.',
        existingAppointment: {
          date: existingAppointment.date.toISOString().split('T')[0],
          time: existingAppointment.time
        }
      });
    }
    // Determine appointment type and duration
    const appointmentType = reqAppointmentType || 'drops-only-install';
    const duration = getDurationForType(appointmentType, reqDuration);

    // Check for scheduling conflicts
    const conflict = await checkSchedulingConflict(date, time, appointmentType, duration);
    if (conflict) {
      return res.status(409).json({
        error: 'Time slot is not available',
        conflictingAppointment: {
          date: conflict.date.toISOString().split('T')[0],
          time: conflict.time
        }
      });
    }

    // Check for duplicate appointments from the same email within 24 hours
    const recentAppointment = await Schedule.findOne({
      email: email,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (recentAppointment) {
      return res.status(429).json({
        error: 'You already have a recent appointment booked. Please wait 24 hours before booking another.',
        existingAppointment: {
          date: recentAppointment.date.toISOString().split('T')[0],
          time: recentAppointment.time
        }
      });
    }

    // Create the appointment
    const appointmentData = {
      quoteNumber,
      quoteId: quote._id,
      appointmentType,
      duration,
      name: validator.escape(validator.trim(name)),
      email: email.toLowerCase(),
      date: new Date(date),
      time,
      phone: phone ? validator.escape(validator.trim(phone)) : undefined,
      notes: notes ? validator.escape(validator.trim(notes)) : undefined,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
      userAgent: req.get('User-Agent')?.substring(0, 200)
    };

    const newSchedule = new Schedule(appointmentData);
    await newSchedule.save();

    // Send confirmation email if email is configured
    const transporter = createEmailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Appointment Confirmation - Action Jackson Installs',
          html: `
            <h2>Appointment Confirmed!</h2>
            <p>Hello ${name.split(' ')[0]},</p>
            <p>Your appointment has been successfully scheduled for Quote #${quoteNumber}:</p>
            <ul>
              <li><strong>Quote Number:</strong> #${quoteNumber}</li>
              <li><strong>Date:</strong> ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
              <li><strong>Time:</strong> ${time}</li>
              ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
            </ul>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p>We'll contact you 24 hours before the appointment to confirm.</p>
            <p>If you need to reschedule, please contact us as soon as possible and reference your quote number #${quoteNumber}.</p>
            <p>Thank you for choosing Action Jackson Installs!</p>
          `
        });

        // Send notification to admin
        if (process.env.ADMIN_EMAIL) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `📅 New Appointment for Quote #${quoteNumber}`,
            html: `
              <h2>New Appointment Scheduled</h2>
              <ul>
                <li><strong>Quote Number:</strong> #${quoteNumber}</li>
                <li><strong>Customer:</strong> ${name}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
                <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
                <li><strong>Time:</strong> ${time}</li>
                <li><strong>Notes:</strong> ${notes || 'None'}</li>
                <li><strong>Package:</strong> ${quote.packageOption}${quote.includeSurvey ? ' + Survey' : ''}</li>
                <li><strong>IP:</strong> ${appointmentData.ip}</li>
              </ul>
            `
          });
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the appointment booking if email fails
      }
    }

    console.log(`Appointment scheduled: ${name} on ${date} at ${time} for Quote #${quoteNumber}`);
    
    res.status(201).json({
      message: `Appointment scheduled successfully for Quote #${quoteNumber}`,
      appointment: {
        id: newSchedule._id,
        quoteNumber: quoteNumber,
        date: date,
        time: time,
        confirmationSent: !!transporter
      }
    });
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    res.status(500).json({ error: 'Error scheduling appointment' });
  }
});

// Get appointment by ID (for confirmation/verification)
router.get('/appointment/:id', async (req, res) => {
  try {
    const appointment = await Schedule.findById(req.params.id)
      .select('name email date time phone notes createdAt');
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({
      id: appointment._id,
      name: appointment.name,
      email: appointment.email,
      date: appointment.date.toISOString().split('T')[0],
      time: appointment.time,
      phone: appointment.phone,
      notes: appointment.notes,
      scheduledAt: appointment.createdAt
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Error fetching appointment details' });
  }
});

// Cancel/delete appointment (simple implementation)
router.delete('/appointment/:id', async (req, res) => {
  try {
    const appointment = await Schedule.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await Schedule.findByIdAndDelete(req.params.id);
    
    console.log(`Appointment cancelled: ${appointment.name} on ${appointment.date}`);
    
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Error cancelling appointment' });
  }
});

module.exports = router;