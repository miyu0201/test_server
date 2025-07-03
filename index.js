require('dotenv').config();
const express = require('express');
const cors = require('cors');

console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set');

const paymentRoutes = require('./process-payment');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow specific origins
    const allowedOrigins = [
      'https://virtwin-energy.se',
      'https://www.virtwin-energy.se'
    ];
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Virtwin Energy Payment Server',
    environment: process.env.NODE_ENV,
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    endpoints: {
      payment: '/api/process-payment',
      test: '/api/test'
    }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      STRIPE_CONFIGURED: !!process.env.STRIPE_SECRET_KEY
    }
  });
});

// Routes
app.use('/api', paymentRoutes);

const PORT = process.env.PORT || 80;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV} mode)`);
}); 