import { NextRequest, NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { verifyCronSecret } from '@/lib/cron-auth'
import { runIngest } from '@/lib/jobs/ingest'
import { runSelection } from '@/lib/jobs/select'
import { runReminder } from '@/lib/jobs/reminder'
import { runSend } from '@/lib/jobs/send'
import { errorMessage } from '@/lib/utils'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// One daily trigger (08:00 IST) that does the right step for the weekday:
//   Mon, Tue  fetch articles
//   Wed       fetch articles, draft the issue, nudge the editor on Telegram
//   Thu, Fri  send the issue, but only if the editor has confirmed it
async function handle(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const day = formatInTimeZone(new Date(), 'Asia/Kolkata', 'EEE')
  const steps: Record<string, unknown> = {}

  async function step(name: string, fn: () => Promise<unknown>) {
    try {
      steps[name] = await fn()
    } catch (err) {
      steps[name] = { ok: false, error: errorMessage(err) }
    }
  }

  if (day === 'Mon' || day === 'Tue') {
    await step('ingest', runIngest)
  } else if (day === 'Wed') {
    await step('ingest', runIngest)
    await step('select', () => runSelection())
    await step('reminder', runReminder)
  } else if (day === 'Thu' || day === 'Fri') {
    await step('send', runSend)
  }

  return NextResponse.json({ day, steps })
}

export const GET = handle
export const POST = handle
