const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/pics', express.static(path.join(__dirname, 'public/pics')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

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

// Serve index.html for home
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve scheduling.html for /scheduling
app.get('/scheduling', (req, res) => {
  res.sendFile(__dirname + '/public/scheduling.html');
});

// Serve quotes.html for /quotes
app.get('/quotes', (req, res) => {
  res.sendFile(__dirname + '/public/quotes.html');
});

app.get('/about', (req, res) => {
  res.sendFile(__dirname, '/public/quotes.html');
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
