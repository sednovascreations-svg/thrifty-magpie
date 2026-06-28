const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ectsdmjzemifbvaahhiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  const { email } = JSON.parse(event.body || '{}')

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) }
  }

  const { data } = await supabase
    .from('subscribers')
    .select('active')
    .eq('email', email)
    .single()

  return {
    statusCode: 200,
    body: JSON.stringify({ isPro: data?.active === true })
  }
}