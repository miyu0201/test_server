const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/process-payment', async (req, res) => {
  try {
    const { 
      payment_method,
      payment_method_id,
      swish_number,
      personal_number,
      plan, 
      cycle, 
      price, 
      billing_details 
    } = req.body;

    // Convert price to öre (1 SEK = 100 öre)
    const amount = Math.round(parseFloat(price) * 100);

    let paymentIntent;

    switch(payment_method) {
      case 'card':
        // Create a customer for card payments
        const customer = await stripe.customers.create({
          payment_method: payment_method_id,
          email: billing_details.email,
          name: billing_details.name,
          address: billing_details.address
        });

        // Create payment intent for card payment
        paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'sek',
          customer: customer.id,
          payment_method: payment_method_id,
          off_session: false,
          confirm: true,
          metadata: {
            plan: plan,
            cycle: cycle
          },
          payment_method_types: ['card'],
          return_url: 'https://virtwin-energy.se/success.html'
        });
        break;

      case 'swish':
        // Create payment intent for Swish
        paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'sek',
          payment_method_types: ['swish'],
          metadata: {
            plan: plan,
            cycle: cycle,
            swish_number: swish_number
          }
        });

        // Confirm the Swish payment
        await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: 'swish',
          return_url: 'https://virtwin-energy.se/success.html'
        });
        break;

      case 'klarna':
        // Create source for Klarna
        const source = await stripe.sources.create({
          type: 'klarna',
          amount: amount,
          currency: 'sek',
          klarna: {
            product: 'payment',
            purchase_country: 'SE',
            first_name: billing_details.name.split(' ')[0],
            last_name: billing_details.name.split(' ').slice(1).join(' '),
            locale: 'sv-SE'
          },
          metadata: {
            plan: plan,
            cycle: cycle,
            personal_number: personal_number
          },
          redirect: {
            return_url: 'https://virtwin-energy.se/success.html'
          }
        });

        // Create and confirm payment intent with Klarna source
        paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'sek',
          payment_method_types: ['klarna'],
          source: source.id,
          confirm: true,
          metadata: {
            plan: plan,
            cycle: cycle
          },
          return_url: 'https://virtwin-energy.se/success.html'
        });
        break;

      default:
        throw new Error('Invalid payment method');
    }

    if (paymentIntent.status === 'requires_action' || 
        paymentIntent.status === 'requires_source_action') {
      // 3D Secure is required
      res.json({
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        return_url: paymentIntent.next_action?.redirect_to_url?.url
      });
    } else if (paymentIntent.status === 'requires_confirmation') {
      // Additional confirmation required (e.g., for Swish)
      res.json({
        requires_confirmation: true,
        client_secret: paymentIntent.client_secret
      });
    } else {
      // Payment successful
      res.json({
        success: true
      });
    }
  } catch (err) {
    console.error('Payment processing error:', err);
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router; 