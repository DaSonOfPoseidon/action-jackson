const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(compression());
mongoose.set('strictQuery', false);
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/pics', express.static(path.join(__dirname, 'public/pics')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://kit.fontawesome.com"],
      styleSrc: ["'self'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com"],
    }
  }
}));

app.set('trust proxy', true);

// Subdomain-based variant detection: sets which “half” of the site we’re on and the switcher URL
app.use((req, res, next) => {
  const subdomains = req.subdomains || [];
  res.locals.variant = subdomains.includes('dev') ? 'portfolio' : 'business';
  res.locals.switcherUrl = res.locals.variant === 'business'
    ? 'https://dev.actionjacksoninstalls.com'
    : 'https://actionjacksoninstalls.com';
  next();
});

function createSessionToken(userId) {
  // sign a JWT or generate a secure random session ID tied to a store
  return /* your token logic */;
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await findAndVerifyUser(username, password); // implement this
  if (!user) return res.status(401).render('login', { title: 'Login', error: 'Invalid credentials' });
  const token = createSessionToken(user.id);
  res.cookie('session', token, {
    domain: '.actionjacksoninstalls.com',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
  });
  res.redirect('/');
});

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

// Use API routes
app.use('/api/home', homeRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/shared', sharedRoutes);

// Home
app.get('/', (req, res) => {
  if (res.locals.variant === 'portfolio') {
    res.render('portfolio', { title: 'Action Jackson Builds' });
  } else {
    res.render('index', { title: 'Home' });
  }
});

// Scheduling
app.get('/scheduling', (req, res) => {
  res.render('scheduling', { title: 'Schedule' });
});

// Quotes
app.get('/quotes', (req, res) => {
  res.render('quotes', { title: 'Quotes' });
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
  
  res.status(statusCode).render('error', { 
    title: `Error ${statusCode}`, 
    message: message,
    statusCode: statusCode
  });
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Page Not Found', 
    message: 'The page you\'re looking for doesn\'t exist.',
    statusCode: 404
  });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
