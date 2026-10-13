'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [kind, setKind] = useState<'ok' | 'info' | 'err'>('ok')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })

      const data = await res.json()

      if (res.ok && data.success !== false) {
        setSuccess(true)
        setKind('ok')
        setMessage(data.message)
        setEmail('')
        setName('')
      } else if (res.ok) {
        setKind('info')
        setMessage(data.message || 'You are already on the list.')
      } else {
        setKind('err')
        setMessage(data.message || 'Subscription failed')
      }
    } catch (err) {
      setKind('err')
      setMessage('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dp-root">
      <nav className="dp-nav">
        <div className="dp-nav-inner">
          <Link href="/" className="dp-brand">
            The <span>Dispatch</span>
          </Link>
          <Link href="/admin" className="dp-navlink">
            Admin
          </Link>
        </div>
      </nav>

      <section className="dp-hero">
        <h1>
          The week in Indian startups, <em>edited</em> not aggregated.
        </h1>
        <p>
          A weekly newsletter for founders, operators and VCs: under-reported stories, structural shifts and plain-English
          commentary.
        </p>

        <div className="paper paper-scroll" aria-label="Sample edition layout">
          <p className="sc-label" style={{ textAlign: 'center', margin: '0 0 6px' }}>
            Sample layout &middot; Weekly edition
          </p>
          <h2 className="masthead">The Dispatch</h2>
          <hr className="paper-rule" />
          <div className="paper-cols">
            <article>
              <p className="sc-label">Funding &amp; VC</p>
              <h3>A headline for the week&rsquo;s sharpest funding story</h3>
              <p className="src">Source name</p>
              <p>
                Each story gets two or three sentences of editorial commentary: what happened, why it matters and what
                most coverage missed. Numbers first, plain English always.
              </p>
            </article>
            <article>
              <p className="sc-label">Policy &amp; Regulation</p>
              <h3>What a new rule changes for founders</h3>
              <p className="src">Source name</p>
              <p>
                Eight to ten stories span at least three topics, so the issue reads as a view of the whole ecosystem and not
                a single beat.
              </p>
            </article>
            <article>
              <p className="sc-label">IPOs &amp; Exits</p>
              <h3>Where public markets are rewarding discipline</h3>
              <p className="src">Source name</p>
              <p>
                Every issue is reviewed and confirmed by an editor before it goes out. Nothing is sent without a human yes.
              </p>
            </article>
          </div>
        </div>

        <a href="#subscribe">
          <button type="button" className="dp-btn dp-btn-lg">
            Subscribe
          </button>
        </a>
        <div className="dp-bounce" aria-hidden="true">
          &darr;
        </div>
      </section>

      <section id="subscribe" className="dp-wrap" style={{ padding: '48px 24px 96px' }}>
        <div className="dp-grid">
          <div className="dp-card">
            <h2 className="dp-h2">Subscribe</h2>
            <p className="dp-muted" style={{ marginBottom: 24 }}>
              One email a week. Unsubscribe any time.
            </p>
            {!success ? (
              <form onSubmit={handleSubscribe} className="dp-stack" style={{ gap: 16 }}>
                <div>
                  <label className="dp-label">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="dp-label">Name (optional)</label>
                  <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="dp-btn">
                  {loading ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            ) : (
              <div className="dp-note" role="status">
                <div style={{ fontSize: 28, color: '#3fb950', marginBottom: 6 }}>&#10003;</div>
                {message}
              </div>
            )}
            {message && !success && (
              <p className={kind === 'err' ? 'dp-note err' : 'dp-note'} role="status" style={{ marginTop: 16 }}>
                {message}
              </p>
            )}
          </div>

          <div className="dp-card">
            <h2 className="dp-h2">What is The Dispatch?</h2>
            <p className="dp-muted" style={{ marginBottom: 12 }}>
              A weekly newsletter curated by Shreya for founders, operators, and VCs building India&rsquo;s startup
              ecosystem.
            </p>
            <p className="dp-muted">
              We surface counterintuitive stories, under-reported trends, and structural shifts, delivered in plain English
              with editorial commentary on what matters.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
