const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
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

// Helper function to check for scheduling conflicts
const checkSchedulingConflict = async (date, time, excludeId = null) => {
  const appointmentDateTime = new Date(`${date}T${time}:00`);
  const bufferMinutes = 60; // 1-hour buffer between appointments
  
  const conflictStart = new Date(appointmentDateTime.getTime() - bufferMinutes * 60000);
  const conflictEnd = new Date(appointmentDateTime.getTime() + bufferMinutes * 60000);
  
  const query = {
    date: {
      $gte: conflictStart,
      $lte: conflictEnd
    }
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflictingAppointment = await Schedule.findOne(query);
  return conflictingAppointment;
};

// Validation middleware for booking
const validateBooking = [
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
      
      // Check if it's a weekend (optional business rule)
      const dayOfWeek = appointmentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        throw new Error('Appointments are only available Monday through Friday');
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
      
      // Only allow appointments at 30-minute intervals
      if (minutes !== 0 && minutes !== 30) {
        throw new Error('Appointments must be scheduled at 30-minute intervals (e.g., 9:00, 9:30)');
      }
      
      return true;
    }),
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
      }).select('time name');
      
      res.json({
        date: requestedDate,
        bookedSlots: bookedSlots.map(slot => ({
          time: slot.time,
          customerName: slot.name?.split(' ')[0] // Only first name for privacy
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

  const { name, email, date, time, phone, notes } = req.body;

  try {
    // Check for scheduling conflicts
    const conflict = await checkSchedulingConflict(date, time);
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
            <p>Your appointment has been successfully scheduled:</p>
            <ul>
              <li><strong>Date:</strong> ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
              <li><strong>Time:</strong> ${time}</li>
              ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
            </ul>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p>We'll contact you 24 hours before the appointment to confirm.</p>
            <p>If you need to reschedule, please contact us as soon as possible.</p>
            <p>Thank you for choosing Action Jackson Installs!</p>
          `
        });

        // Send notification to admin
        if (process.env.ADMIN_EMAIL) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: '📅 New Appointment Booked',
            html: `
              <h2>New Appointment Scheduled</h2>
              <ul>
                <li><strong>Customer:</strong> ${name}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
                <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
                <li><strong>Time:</strong> ${time}</li>
                <li><strong>Notes:</strong> ${notes || 'None'}</li>
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

    console.log(`Appointment scheduled: ${name} on ${date} at ${time}`);
    
    res.status(201).json({
      message: 'Appointment scheduled successfully',
      appointment: {
        id: newSchedule._id,
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