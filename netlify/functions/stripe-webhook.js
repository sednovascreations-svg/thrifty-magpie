const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ectsdmjzemifbvaahhiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature']
  let stripeEvent

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  if (stripeEvent.type === 'checkout.session.completed' ||
      stripeEvent.type === 'invoice.paid') {
    const session = stripeEvent.data.object
    const email = session.customer_details?.email || session.customer_email

    if (email) {
      await supabase.from('subscribers').upsert({
        email,
        stripe_customer_id: session.customer,
        active: true,
        subscribed_at: new Date().toISOString()
      }, { onConflict: 'email' })
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const customerId = stripeEvent.data.object.customer
    await supabase
      .from('subscribers')
      .update({ active: false })
      .eq('stripe_customer_id', customerId)
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}