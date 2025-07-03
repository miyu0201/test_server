require('dotenv').config();
const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./process-payment');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://virtwin-energy.se',
  credentials: true
}));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Virtwin Energy Payment Server',
    endpoints: {
      payment: '/api/process-payment'
    }
  });
});

// Routes
app.use('/api', paymentRoutes);

const PORT = process.env.PORT || 80;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV} mode)`);
}); 