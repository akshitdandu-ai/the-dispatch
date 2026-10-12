import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getWeekKeyIST, errorMessage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function summarize(details: any): string {
  if (!details) return ''
  if (details.error) return String(details.error).slice(0, 140)
  if (typeof details.inserted === 'number') return `fetched ${details.fetched}, new ${details.inserted}, duplicates ${details.duplicates}`
  if (typeof details.picks === 'number') return `${details.picks} picks, ${details.backups} backups`
  return JSON.stringify(details).slice(0, 140)
}

export async function GET() {
  try {
    const weekKey = getWeekKeyIST()

    const { count: articlesThisWeek } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('week_key', weekKey)

    const { data: issues } = await supabase
      .from('issues')
      .select('id, week_key, status, subject, intro, topics, reminder_sent_at, confirmed_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(1)
    const issue = issues?.[0] ?? null

    let picks: any[] = []
    if (issue) {
      const { data: items } = await supabase
        .from('issue_items')
        .select('topic, commentary, article_id, position')
        .eq('issue_id', issue.id)
        .eq('role', 'pick')
        .order('position', { ascending: true })

      const ids = (items || []).map((i: any) => i.article_id)
      const { data: articles } = ids.length
        ? await supabase.from('articles').select('id, title, url, source_name').in('id', ids)
        : { data: [] }
      const byId = new Map((articles || []).map((a: any) => [a.id, a]))
      picks = (items || []).map((i: any) => {
        const a: any = byId.get(i.article_id) || {}
        return { topic: i.topic, commentary: i.commentary, title: a.title, url: a.url, source: a.source_name }
      })
    }

    const { data: runs } = await supabase
      .from('run_logs')
      .select('job, ok, details, created_at')
      .order('created_at', { ascending: false })
      .limit(8)

    return NextResponse.json({
      weekKey,
      articlesThisWeek: articlesThisWeek ?? 0,
      issue,
      picks,
      runs: (runs || []).map((r: any) => ({ job: r.job, ok: r.ok, at: r.created_at, summary: summarize(r.details) })),
    })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
