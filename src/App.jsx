import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const STRIPE_LINK = 'https://buy.stripe.com/3cIbJ1aZ75uV3G45Jh3cc00'
const DAILY_FREE_LIMIT = 5

function getTodayKey() {
  return 'scans_' + new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [user, setUser] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [scansToday, setScansToday] = useState(0)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const key = getTodayKey()
    const saved = parseInt(localStorage.getItem(key) || '0')
    setScansToday(saved)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) checkSubscription(session.user.email)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) checkSubscription(session.user.email)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkSubscription(email) {
    try {
      const res = await fetch('/.netlify/functions/check-subscription', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      setIsPro(data.isPro)
    } catch (err) {
      console.error('Subscription check failed:', err)
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://the-thrifty-magpie.netlify.app/' }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setIsPro(false)
  }

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null)
    setError(null)

    const canvas = document.createElement('canvas')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        const jpeg = new File([blob], 'item.jpg', { type: 'image/jpeg' })
        setImage(jpeg)
        setPreview(canvas.toDataURL('image/jpeg'))
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  }

  async function analyze() {
    if (!image) return

    if (!isPro) {
      const key = getTodayKey()
      const count = parseInt(localStorage.getItem(key) || '0')
      if (count >= DAILY_FREE_LIMIT) {
        setError('limit')
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      reader.readAsDataURL(image)
      reader.onload = async () => {
        try {
          const base64 = reader.result.replace(/^data:image\/\w+;base64,/, '')

          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 1024,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: 'image/jpeg',
                        data: base64
                      }
                    },
                    {
                      type: 'text',
                      text: 'You are a thrift store reselling expert. Identify this item and return ONLY a JSON object with these fields: item (string), flipScore (0-100 integer), lowPrice (number), avgPrice (number), highPrice (number), platforms (array of strings), tips (array of 2-3 strings). No markdown, no explanation, just the JSON object.'
                    }
                  ]
                }
              ]
            })
          })

          const data = await res.json()
          if (data.error) throw new Error(JSON.stringify(data.error))

          const text = data.content[0].text
          const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
          setResult(parsed)

          if (!isPro) {
            const key = getTodayKey()
            const newCount = parseInt(localStorage.getItem(key) || '0') + 1
            localStorage.setItem(key, newCount)
            setScansToday(newCount)
          }
        } catch (err) {
          setError('Something went wrong. Please try again.')
          console.error(err)
        } finally {
          setLoading(false)
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function reset() {
    setImage(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const scansLeft = DAILY_FREE_LIMIT - scansToday

  if (authLoading) {
    return (
      <div style={styles.centered}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <img src="/logo.svg" alt="The Thrifty Magpie" style={styles.logo} />
        <h1 style={styles.title}>The Thrifty Magpie</h1>
        {user ? (
          <div style={styles.userBar}>
            <span style={styles.userEmail}>{user.email}</span>
            {isPro && <span style={styles.proBadge}>PRO</span>}
            <button onClick={signOut} style={styles.signOutBtn}>Sign out</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} style={styles.googleBtn}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} style={{ marginRight: 8 }} />
            Sign in with Google
          </button>
        )}
      </div>

      {!isPro && (
        <div style={styles.scanBar}>
          {user
            ? `${scansLeft} free scan${scansLeft !== 1 ? 's' : ''} left today`
            : `${scansLeft} free scan${scansLeft !== 1 ? 's' : ''} left · Sign in to track across devices`}
        </div>
      )}
      {isPro && (
        <div style={{ ...styles.scanBar, background: '#f0fdf4', color: '#16a34a' }}>
          ✨ Pro — unlimited scans
        </div>
      )}

      <div style={styles.card}>
        {!result ? (
          <>
            <label style={styles.uploadArea}>
              {preview
                ? <img src={preview} alt="preview" style={styles.preview} />
                : (
                  <div style={styles.uploadPlaceholder}>
                    <div style={{ fontSize: 48 }}>📷</div>
                    <div style={{ marginTop: 12, fontWeight: 600 }}>Tap to take or upload a photo</div>
                    <div style={{ marginTop: 6, color: '#888', fontSize: 14 }}>Any thrift store item</div>
                  </div>
                )}
              <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            </label>

            {error === 'limit' && (
              <div style={styles.limitBox}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>You've used your 5 free scans today!</div>
                <div style={{ marginBottom: 16, color: '#555', fontSize: 14 }}>Upgrade to Pro for unlimited scans.</div>
                <a href={STRIPE_LINK} style={styles.upgradeBtn}>Upgrade to Pro — $4.99/month</a>
              </div>
            )}

            {error && error !== 'limit' && (
              <div style={styles.errorBox}>{error}</div>
            )}

            {image && (
              <button onClick={analyze} disabled={loading} style={styles.analyzeBtn}>
                {loading ? 'Analyzing...' : '🔍 Find resale prices'}
              </button>
            )}
          </>
        ) : (
          <>
            <div style={styles.resultHeader}>
              <img src={preview} alt="item" style={styles.resultThumb} />
              <div>
                <div style={styles.itemName}>{result.item}</div>
                <div style={styles.flipScore(result.flipScore)}>
                  Flip Score: {result.flipScore}/100
                </div>
              </div>
            </div>

            <div style={styles.priceRow}>
              <div style={styles.priceBox}>
                <div style={styles.priceLabel}>Low</div>
                <div style={styles.priceVal}>${result.lowPrice}</div>
              </div>
              <div style={styles.priceBox}>
                <div style={styles.priceLabel}>Avg</div>
                <div style={styles.priceVal}>${result.avgPrice}</div>
              </div>
              <div style={{ ...styles.priceBox, background: '#f0fdf4' }}>
                <div style={styles.priceLabel}>High</div>
                <div style={{ ...styles.priceVal, color: '#16a34a' }}>${result.highPrice}</div>
              </div>
            </div>

            <div style={styles.sectionTitle}>Best platforms</div>
            <div style={styles.platforms}>
              {result.platforms?.map(p => (
                <span key={p} style={styles.platformTag}>{p}</span>
              ))}
            </div>

            <div style={styles.sectionTitle}>Selling tips</div>
            {result.tips?.map((t, i) => (
              <div key={i} style={styles.tip}>→ {t}</div>
            ))}

            <button onClick={reset} style={styles.resetBtn}>📷 Scan another item</button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: '0 16px 40px', fontFamily: 'system-ui, sans-serif' },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  header: { textAlign: 'center', padding: '24px 0 8px' },
  logo: { width: 400, height: 400, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 800, margin: '0 0 12px', color: '#1a1a1a' },
  userBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  userEmail: { fontSize: 13, color: '#555' },
  proBadge: { background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 },
  signOutBtn: { fontSize: 13, color: '#888', background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' },
  googleBtn: { display: 'inline-flex', alignItems: 'center', background: '#fff', border: '1px solid #ddd', borderRadius: 10, padding: '10px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  scanBar: { textAlign: 'center', fontSize: 13, color: '#888', background: '#f9f9f9', borderRadius: 10, padding: '8px 16px', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 20 },
  uploadArea: { display: 'flex', cursor: 'pointer', border: '2px dashed #e5e5e5', borderRadius: 16, overflow: 'hidden', marginBottom: 16, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  uploadPlaceholder: { textAlign: 'center', padding: 32 },
  preview: { width: '100%', borderRadius: 14, display: 'block' },
  analyzeBtn: { width: '100%', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 17, fontWeight: 700, cursor: 'pointer' },
  limitBox: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 20, textAlign: 'center', marginBottom: 16 },
  upgradeBtn: { display: 'inline-block', background: '#f97316', color: '#fff', fontWeight: 700, borderRadius: 12, padding: '12px 24px', textDecoration: 'none', fontSize: 15 },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 14, color: '#dc2626', marginBottom: 16, fontSize: 14 },
  resultHeader: { display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 },
  resultThumb: { width: 72, height: 72, borderRadius: 12, objectFit: 'cover' },
  itemName: { fontSize: 18, fontWeight: 800, marginBottom: 4 },
  flipScore: (score) => ({ fontSize: 13, fontWeight: 600, color: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626' }),
  priceRow: { display: 'flex', gap: 10, marginBottom: 16 },
  priceBox: { flex: 1, background: '#f9f9f9', borderRadius: 12, padding: '12px 8px', textAlign: 'center' },
  priceLabel: { fontSize: 11, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  priceVal: { fontSize: 20, fontWeight: 800 },
  sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8, marginTop: 16 },
  platforms: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  platformTag: { background: '#f0f0ff', color: '#7c3aed', borderRadius: 99, padding: '4px 12px', fontSize: 13, fontWeight: 600 },
  tip: { fontSize: 14, color: '#444', marginBottom: 6, lineHeight: 1.5 },
  resetBtn: { width: '100%', marginTop: 20, background: '#f3f4f6', border: 'none', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer' }
}