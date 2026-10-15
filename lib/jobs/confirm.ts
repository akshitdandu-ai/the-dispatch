import { supabase } from '../db'
import { getWeekKeyIST } from '../utils'

export async function runConfirm(): Promise<{ ok: boolean; message: string }> {
  const weekKey = getWeekKeyIST()

  const { data: issue } = await supabase.from('issues').select('id, status').eq('week_key', weekKey).single()

  if (!issue) return { ok: false, message: 'No issue for this week yet. Run Selection Now first.' }
  if (issue.status === 'confirmed') return { ok: true, message: 'Already confirmed. You can click Send Newsletter now.' }
  if (issue.status !== 'draft' && issue.status !== 'in_review') {
    return {
      ok: false,
      message: `This issue is ${issue.status}. Run Selection Now to start a fresh draft, then confirm it.`,
    }
  }

  const { error } = await supabase
    .from('issues')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', issue.id)
    .in('status', ['draft', 'in_review'])

  if (error) return { ok: false, message: `Could not confirm: ${error.message}` }
  return { ok: true, message: 'Draft confirmed. Click Send Newsletter to deliver it.' }
}
