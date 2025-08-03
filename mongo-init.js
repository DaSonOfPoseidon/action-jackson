// MongoDB initialization script for creating a read-only development user
// This script runs when the MongoDB container first starts

db = db.getSiblingDB('action_jackson');

// Create a read-only user for development
// Password comes from environment variable for security
db.createUser({
  user: 'devuser',
  pwd: process.env.MONGO_DEV_PASSWORD || 'changeme123',
  roles: [
    {
      role: 'readWrite',
      db: 'action_jackson'
    }
  ]
});

print('Development read-only user created successfully');

// Optionally create some sample data if the collections are empty
if (db.services.countDocuments() === 0) {
  print('Creating sample data...');
  
  // Sample services
  db.services.insertMany([
    {
      name: 'Network Installation',
      description: 'Professional network setup and configuration',
      price: 150,
      createdAt: new Date()
    },
    {
      name: 'Cable Management', 
      description: 'Clean and organized cable routing',
      price: 75,
      createdAt: new Date()
    },
    {
      name: 'Device Setup',
      description: 'Router, switch, and device configuration',
      price: 100,
      createdAt: new Date()
    }
  ]);

  // Sample testimonials
  db.testimonials.insertMany([
    {
      name: 'John Smith',
      message: 'Excellent service! Professional installation and great attention to detail.',
      rating: 5,
      createdAt: new Date()
    },
    {
      name: 'Sarah Johnson',
      message: 'Quick and reliable. Would definitely recommend Action Jackson!',
      rating: 5,
      createdAt: new Date()
    },
    {
      name: 'Mike Davis',
      message: 'Great work on our home network setup. Everything works perfectly.',
      rating: 4,
      createdAt: new Date()
    }
  ]);

  print('Sample data created successfully');
}