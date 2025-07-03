const express = require('express');
const router = express.Router();

// Check if Stripe secret key is available
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  throw new Error('Stripe configuration missing');
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/process-payment', async (req, res) => {
  try {
    console.log('Payment request received:', JSON.stringify(req.body, null, 2));
    
    const { 
      payment_method,
      payment_method_id,
      swish_number,
      personal_number,
      plan, 
      cycle, 
      price,
      amount: clientAmount,
      billing_details,
      metadata
    } = req.body;

    // Handle amount - either from amount field (client sends in öre) or price field (convert to öre)
    let amount;
    if (clientAmount && !isNaN(clientAmount)) {
      amount = parseInt(clientAmount);
    } else if (price && !isNaN(price)) {
      amount = Math.round(parseFloat(price) * 100);
    } else {
      throw new Error('Invalid amount or price provided');
    }

    console.log('Calculated amount in öre:', amount);

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
            cycle: cycle,
            ...metadata
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
            swish_number: swish_number,
            ...metadata
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
            personal_number: personal_number,
            ...metadata
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
            cycle: cycle,
            ...metadata
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
      console.log('Payment successful:', paymentIntent.id);
      res.json({
        success: true,
        payment_intent_id: paymentIntent.id
      });
    }
  } catch (err) {
    console.error('Payment processing error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      error: err.message,
      type: err.type || 'general_error'
    });
  }
});

module.exports = router; 