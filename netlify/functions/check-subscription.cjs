const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://ectsdmjzemifbvaahhiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  const { email } = JSON.parse(event.body || '{}')

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) }
  }

  const { data } = await supabase
    .from('subscribers')
    .select('active')
    .eq('email', email)
    .single()

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ isPro: data?.active === true })
  }
}