import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from './env'
import { z } from 'zod'

let client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is not set on this deployment. Add it in Vercel (Production and Preview) and redeploy.'
      )
    }
    client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }
  return client
}

const selectionSchema = z.object({
  picks: z.array(
    z.object({
      article_id: z.string().uuid(),
      topic: z.string(),
      why_selected: z.string(),
      signal_score: z.number().min(1).max(10),
    })
  ),
  backups: z.array(
    z.object({
      article_id: z.string().uuid(),
      topic: z.string(),
      why_selected: z.string(),
      rank: z.number().int().positive(),
    })
  ),
  issue_theme: z.string(),
})

const commentarySchema = z.object({
  items: z.array(
    z.object({
      article_id: z.string().uuid(),
      commentary: z.string(),
    })
  ),
})

const subjectSchema = z.object({
  subject: z.string(),
  intro: z.string(),
})

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

function isRetryable(err: Error): boolean {
  const m = err.message.toLowerCase()
  return (
    m.includes('429') ||
    m.includes('500') ||
    m.includes('503') ||
    m.includes('overloaded') ||
    m.includes('high demand') ||
    m.includes('too many') ||
    m.includes('fetch failed') ||
    err instanceof SyntaxError ||
    err instanceof z.ZodError
  )
}

async function callModel<T>(modelName: string, prompt: string, schema: z.ZodType<T>, maxRetries: number): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getClient().getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      })

      const result = await model.generateContent(prompt)
      return schema.parse(extractJson(result.response.text()))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (isRetryable(lastError) && attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000
        console.log(`Gemini ${modelName} failed (${lastError.message.slice(0, 100)}), retrying in ${Math.round(backoffMs)}ms`)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        continue
      }

      throw lastError
    }
  }

  throw lastError || new Error('Failed to call Gemini after retries')
}

async function callGeminiWithRetry<T>(prompt: string, schema: z.ZodType<T>, maxRetries = 5): Promise<T> {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const models = [env.GEMINI_MODEL, ...fallbacks.filter((m) => m !== env.GEMINI_MODEL)]

  let lastError: Error | null = null
  for (const modelName of models) {
    try {
      return await callModel(modelName, prompt, schema, maxRetries)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Gemini model ${modelName} failed:`, lastError.message)
    }
  }

  throw lastError || new Error('Failed to call Gemini')
}

export async function selectArticles(
  candidates: Array<{
    id: string
    title: string
    source: string
    published_at: string
    topic: string
    summary: string
  }>,
  lastHeadlines: string[],
  styleGuide: string
): Promise<{
  picks: Array<{ article_id: string; topic: string; why_selected: string }>
  backups: Array<{ article_id: string; topic: string; why_selected: string }>
  issue_theme: string
}> {
  // Limit to 150 most recent candidates
  const topCandidates = candidates.slice(0, 150)

  const candidateList = topCandidates
    .map(
      (c) =>
        `- ID: ${c.id}, Title: "${c.title}", Source: ${c.source}, Topic: ${c.topic}, Date: ${c.published_at}, Summary: ${c.summary.slice(0, 300)}`
    )
    .join('\n')

  const lastHeadlinesText = lastHeadlines.length > 0 ? `Recent headlines to avoid re-covering:\n${lastHeadlines.join('\n')}\n\n` : ''

  const styleGuideSnippet = styleGuide.slice(0, 500)

  const prompt = `You are Shreya, a newsletter editor for The Dispatch. Your role is to select the 8-10 most compelling stories from this week's batch that are:
- Counterintuitive or under-reported
- Connect two or more trends
- Contain substance (numbers, policy shifts, structural changes)
- Not covered in the recent issues below
- Collectively span at least 3 different topic areas

${lastHeadlinesText}

Your style guide priorities:
${styleGuideSnippet}

Candidate articles this week:
${candidateList}

Select 8-10 picks and provide 5 backups ranked by signal. Output JSON:
{
  "picks": [{"article_id": "uuid", "topic": "string", "why_selected": "one line", "signal_score": 1-10}],
  "backups": [{"article_id": "uuid", "topic": "string", "why_selected": "string", "rank": 1}],
  "issue_theme": "one line theme for this week"
}`

  const result = await callGeminiWithRetry(prompt, selectionSchema)

  return result
}

export async function generateCommentary(
  articles: Array<{
    id: string
    title: string
    source: string
    summary: string
  }>,
  styleGuide: string
): Promise<Array<{ article_id: string; commentary: string }>> {
  const articlesText = articles
    .map((a) => `ID: ${a.id}\nTitle: "${a.title}"\nSource: ${a.source}\nSummary: ${a.summary}\n---`)
    .join('\n')

  const prompt = `You are Shreya, editor of The Dispatch. Write 2-3 sentence commentary (max 65 words) for each article below, in your distinctive voice (sharp, skeptical but fair, data-first, plain English). Never restate the headline, never invent facts beyond what's in the summary.

Your voice and approach:
${styleGuide}

Articles to comment on:
${articlesText}

Output JSON: { "items": [{ "article_id": "uuid", "commentary": "string" }] } with one entry per article.`

  const result = await callGeminiWithRetry(prompt, commentarySchema)

  return result.items
}

export async function generateSubjectAndIntro(issueTheme: string, styleGuide: string): Promise<{ subject: string; intro: string }> {
  const prompt = `You are Shreya, editor of The Dispatch. Generate:
1. A subject line (≤60 chars) for an issue with theme: "${issueTheme}"
2. A 1-2 sentence intro in your voice for the newsletter

Style guide:
${styleGuide}

Output JSON: { "subject": "string", "intro": "string" }`

  const result = await callGeminiWithRetry(prompt, subjectSchema)

  return result
}
