const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();

// CORS for Next.js frontend
const allowedOrigins = [
  'http://localhost:3000',
  'https://actionjacksoninstalls.com',
  'https://www.actionjacksoninstalls.com'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(cookieParser());
app.use(compression());
mongoose.set('strictQuery', false);
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit form data size
app.use(express.static('public'));
app.use('/pics', express.static(path.join(__dirname, 'public/pics')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://kit.fontawesome.com", "https://kit-free.fontawesome.com", "https://ka-f.fontawesome.com", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://ka-f.fontawesome.com", "https://ka-p.fontawesome.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://ka-f.fontawesome.com", "https://ka-p.fontawesome.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com", "https://ka-f.fontawesome.com", "https://ka-p.fontawesome.com"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));

// Configure trust proxy securely - only trust first proxy (e.g., Cloudflare)
app.set('trust proxy', 1);

// Session configuration for admin authentication
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'fallback-secret-change-immediately',
  name: 'admin-session',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGO_URI ? MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600, // lazy session update (24 hours)
    crypto: {
      secret: process.env.ADMIN_SESSION_SECRET || 'fallback-secret-change-immediately'
    }
  }) : undefined,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1 hour
    sameSite: 'strict'
  },
  rolling: true // Reset expiration on activity
}));

// Subdomain-based variant detection: sets which "half" of the site we're on and the switcher URL
app.use((req, res, next) => {
  const subdomains = req.subdomains || [];
  const hostname = req.hostname || req.get('host') || '';
  
  // Debug logging
  //console.log('Host:', req.get('host'));
  //console.log('Hostname:', hostname);
  //console.log('Subdomains:', subdomains);
  
  // Check if hostname starts with 'dev.' or includes 'dev'
  const isPortfolio = subdomains.includes('dev') || hostname.startsWith('dev.');
  res.locals.variant = isPortfolio ? 'portfolio' : 'business';
  res.locals.switcherUrl = res.locals.variant === 'business'
    ? 'https://dev.actionjacksoninstalls.com'
    : 'https://actionjacksoninstalls.com';
    
  //console.log('Variant:', res.locals.variant);
  next();
});

// Admin authentication system implemented with:
// - JWT tokens with secure secret management
// - bcrypt password hashing with 12 salt rounds
// - Rate limiting on auth endpoints (3 attempts/15min)
// - Account lockout and brute force protection

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}
connectDB();


// Import API routes
const homeRoutes = require('./routes/home');
const schedulingRoutes = require('./routes/scheduling');
const quotesRoutes = require('./routes/quotes');
const sharedRoutes = require('./routes/shared');
const invoicesRoutes = require('./routes/invoices');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const fileRoutes = require('./routes/files');
const estimateRoutes = require('./routes/estimates');
const consultationRoutes = require('./routes/consultations');

// Use API routes
app.use('/api/home', homeRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/shared', sharedRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// Home
app.get('/', (req, res) => {
  if (res.locals.variant === 'portfolio') {
    res.render('portfolio', { title: 'Action Jackson Builds' });
  } else {
    res.render('index', { title: 'Home' });
  }
});

// Scheduling - redirect to quotes flow
app.get('/scheduling', (req, res) => {
  res.redirect('/quotes');
});

// Quotes
app.get('/quotes', (req, res) => {
  res.render('quotes', { title: 'Get Connected' });
});

// Estimate Builder
app.get('/estimate', (req, res) => {
  res.render('estimate', { title: 'Estimate Builder' });
});

// About
app.get('/about', (req, res) => {
  res.render('about', { title: 'About' });
});

app.get('/healthz', async (req, res) => {
  const payload = { app: 'ok', db: null };
  let healthy = true;

  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.db.command({ ping: 1 });
      payload.db = 'ok';
    } catch (err) {
      payload.db = 'error';
      payload.dbError = err.message;
      healthy = false;
    }
  } else {
    payload.db = 'disconnected';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json(payload);
});

// Specific error handler for server errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 ? 'Something went wrong on our end.' : err.message;
  
  // Determine variant if not already set
  if (!res.locals.variant) {
    const hostname = req.hostname || req.get('host') || '';
    const subdomains = hostname.split('.').slice(0, -2);
    const isPortfolio = subdomains.includes('dev') || hostname.startsWith('dev.');
    res.locals.variant = isPortfolio ? 'portfolio' : 'business';
    res.locals.switcherUrl = res.locals.variant === 'business'
      ? 'https://dev.actionjacksoninstalls.com'
      : 'https://actionjacksoninstalls.com';
  }
  
  res.status(statusCode).render('error', { 
    title: `Error ${statusCode}`, 
    message: message,
    statusCode: statusCode,
    variant: res.locals.variant,
    switcherUrl: res.locals.switcherUrl
  });
});

// 404 handler (must be last)
app.use((req, res) => {
  // Determine variant if not already set
  if (!res.locals.variant) {
    const hostname = req.hostname || req.get('host') || '';
    const subdomains = hostname.split('.').slice(0, -2);
    const isPortfolio = subdomains.includes('dev') || hostname.startsWith('dev.');
    res.locals.variant = isPortfolio ? 'portfolio' : 'business';
    res.locals.switcherUrl = res.locals.variant === 'business'
      ? 'https://dev.actionjacksoninstalls.com'
      : 'https://actionjacksoninstalls.com';
  }

  res.status(404).render('error', { 
    title: 'Page Not Found', 
    message: 'The page you\'re looking for doesn\'t exist.',
    statusCode: 404,
    variant: res.locals.variant,
    switcherUrl: res.locals.switcherUrl
  });
});
// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
