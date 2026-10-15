'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Pick = { topic: string; commentary: string; title?: string; url?: string; source?: string }
type Run = { job: string; ok: boolean; at: string; summary: string }
type Overview = {
  weekKey: string
  articlesThisWeek: number
  issue: {
    week_key: string
    status: string
    subject: string
    intro: string
    topics: string[] | null
    reminder_sent_at: string | null
    confirmed_at: string | null
    sent_at: string | null
  } | null
  picks: Pick[]
  runs: Run[]
}

const ACTIONS = [
  { job: 'ingest', title: 'Fetch articles', text: 'Pull this week’s stories from every active feed.', button: 'Run Ingest Now' },
  { job: 'select', title: 'Select stories', text: 'Pick the stories and draft the commentary. Each run replaces this week\u2019s draft with a fresh one.', button: 'Run Selection Now' },
  { job: 'remind', title: 'Telegram reminder', text: 'Nudge the admin chat that the draft needs review.', button: 'Send Reminder Now' },
  { job: 'confirm', title: 'Confirm draft', text: 'Approve the draft for sending (same as Confirm in Telegram).', button: 'Confirm Draft' },
  { job: 'send', title: 'Send newsletter', text: 'Email the confirmed issue to every active subscriber.', button: 'Send Newsletter' },
] as const

export default function AdminPage() {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [data, setData] = useState<Overview | null>(null)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/issue', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load status')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const triggerJob = async (job: string) => {
    if (job === 'send' && !window.confirm('Send the newsletter to all active subscribers now?')) return
    setRunning(job)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/trigger/${job}`, { method: 'POST' })
      const json = await res.json()
      setMessage({
        text: json.message || json.error || (res.ok ? 'Job triggered' : `Job failed (HTTP ${res.status})`),
        ok: res.ok && json.success !== false,
      })
    } catch {
      setMessage({ text: 'Error triggering job', ok: false })
    } finally {
      setRunning(null)
      refresh()
    }
  }

  const issue = data?.issue ?? null
  const status = issue?.status
  const done: Record<string, boolean> = {
    ingest: (data?.articlesThisWeek ?? 0) > 0,
    select: !!issue,
    remind: !!issue?.reminder_sent_at,
    confirm: status === 'confirmed' || status === 'sending' || status === 'sent',
    send: status === 'sent',
  }
  const steps = [
    { key: 'ingest', label: 'Ingest', title: 'Articles fetched', hint: data ? `${data.articlesThisWeek} articles this week` : '' },
    { key: 'select', label: 'Select', title: 'Draft created', hint: issue?.subject || 'No draft for this week yet' },
    { key: 'remind', label: 'Remind', title: 'Reminder sent', hint: 'Telegram message to the admin chat' },
    { key: 'confirm', label: 'Confirm', title: 'Editor confirmation', hint: 'Done in Telegram: Confirm final draft' },
    { key: 'send', label: 'Send', title: 'Delivered to subscribers', hint: issue?.sent_at ? 'Sent' : 'Waiting for confirmation' },
  ]
  const activeKey = steps.find((s) => !done[s.key])?.key
  const stateOf = (key: string) => (done[key] ? 'done' : key === activeKey ? 'active' : 'pending')

  return (
    <div className="dp-root">
      <nav className="dp-nav">
        <div className="dp-nav-inner">
          <Link href="/" className="dp-brand">
            The <span>Dispatch</span>
          </Link>
          <span className="dp-navlink">Admin</span>
        </div>
      </nav>

      <main className="dp-wrap" style={{ padding: '48px 24px 96px' }}>
        <div className="dp-grid">
          <div className="dp-stack">
            <div className="dp-card">
              <h2 className="dp-h2">Pipeline actions</h2>
              <p className="dp-muted" style={{ marginBottom: 24 }}>
                Run each step by hand, in order.
              </p>
              <div className="dp-stack" style={{ gap: 20 }}>
                {ACTIONS.map((a) => (
                  <div key={a.job}>
                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{a.title}</div>
                    <p className="dp-muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                      {a.text}
                    </p>
                    <button
                      className={a.job === 'send' ? 'dp-btn dp-btn-ghost' : 'dp-btn'}
                      disabled={running !== null}
                      onClick={() => triggerJob(a.job)}
                    >
                      {running === a.job ? 'Running…' : a.button}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {message && <div className={message.ok ? 'dp-note' : 'dp-note err'}>{message.text}</div>}

            <div className="dp-card">
              <h2 className="dp-h2" style={{ fontSize: 18 }}>
                Recent activity
              </h2>
              {data?.runs?.length ? (
                data.runs.map((r, i) => (
                  <div className="dp-log" key={i}>
                    <b style={{ color: r.ok ? '#3fb950' : '#f85149' }}>{r.job}</b>
                    <span>{r.summary || (r.ok ? 'ok' : 'failed')}</span>
                  </div>
                ))
              ) : (
                <p className="dp-muted">No runs logged yet.</p>
              )}
            </div>
          </div>

          <div className="dp-stack">
            <div className="dp-card">
              <div className="dp-tracker" aria-label="Pipeline progress">
                {steps.map((s) => (
                  <div className="t" key={s.key}>
                    <div className={`dp-dot ${stateOf(s.key) === 'done' ? 'done' : stateOf(s.key) === 'active' ? 'active' : ''}`} />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              {loadError && (
                <p className="dp-note err" style={{ marginTop: 16 }}>
                  {loadError}
                </p>
              )}
            </div>

            <div className="dp-stack" style={{ gap: 12 }}>
              {steps.map((s) => (
                <div className={`dp-step ${stateOf(s.key)}`} key={s.key}>
                  <div className="mark">{done[s.key] ? '✓' : steps.indexOf(s) + 1}</div>
                  <div>
                    <h4>{s.title}</h4>
                    <div className="dp-muted" style={{ fontSize: 13 }}>
                      {s.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="paper" style={{ padding: '28px 32px' }}>
              <p className="sc-label" style={{ textAlign: 'center', margin: '0 0 6px' }}>
                {issue ? `${issue.week_key} · ${issue.status}` : 'No draft yet'}
              </p>
              <h2 className="masthead">The Dispatch</h2>
              <hr className="paper-rule" />
              {issue ? (
                <>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 24, margin: '0 0 6px' }}>
                    {issue.subject}
                  </h3>
                  <p style={{ fontFamily: "'Crimson Text', serif", fontSize: 15, margin: '0 0 16px' }}>{issue.intro}</p>
                  <div className="paper-cols">
                    {data?.picks.map((p, i) => (
                      <article key={i}>
                        <p className="sc-label">{p.topic}</p>
                        <h3 style={{ fontSize: 18 }}>
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#1c1c1c' }}>
                              {p.title}
                            </a>
                          ) : (
                            p.title
                          )}
                        </h3>
                        <p className="src">{p.source}</p>
                        <p>{p.commentary}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontFamily: "'Crimson Text', serif", textAlign: 'center' }}>
                  Run ingest, then selection, to draft this week&rsquo;s issue.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
