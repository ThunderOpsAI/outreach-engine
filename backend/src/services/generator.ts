import Anthropic from '@anthropic-ai/sdk'
import type { EmailOutput, LinkedInOutput, FollowUp } from '../types/index.js'
import type { PromptContext } from './personaliser.js'

const MODEL = 'claude-3-haiku-20240307'

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function stripJsonFences(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '')
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/, '')
  }
  return cleaned.trim()
}

async function runPrompt<T>(prompt: string, maxTokens: number = 1000): Promise<T> {
  const callLLM = async (strict: boolean): Promise<T> => {
    let finalPrompt = prompt;
    if (strict) {
      finalPrompt = prompt + "\n\nCRITICAL: Return ONLY raw valid JSON. Do NOT include markdown formatting like ```json or any explanations.";
    }
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: 'user', content: finalPrompt }]
    }, { timeout: 10000 });

    const contentBlock = response.content.find(c => c.type === 'text');
    if (!contentBlock || contentBlock.type !== 'text') {
      throw new Error('No text returned from Anthropic');
    }

    const cleanedJson = stripJsonFences(contentBlock.text);
    return JSON.parse(cleanedJson) as T;
  };

  try {
    return await callLLM(false);
  } catch (err) {
    console.warn('Failed to parse JSON on first attempt, retrying with strict prompt:', err);
    try {
      return await callLLM(true);
    } catch (err2) {
      console.error('Failed to parse JSON on second attempt:', err2);
      throw new GenerationError(`Failed to generate valid JSON: ${(err2 as Error).message}`);
    }
  }
}

export async function generateEmail(ctx: PromptContext): Promise<EmailOutput> {
  const prompt = `Return ONLY a JSON object. No explanation. No markdown.
Schema: { "subjects": [string, string, string], "body_short": string, "body_long": string }

Context: ${JSON.stringify(ctx)}
Write 3 subject line variants and 2 email bodies (short <100 words, long 150-200 words).
Tone: ${ctx.tone}. No fluff. No generic openers like "I hope this finds you well."`

  return runPrompt<EmailOutput>(prompt, 1000);
}

export async function generateLinkedIn(ctx: PromptContext): Promise<LinkedInOutput> {
  const prompt = `Return ONLY a JSON object. No explanation. No markdown.
Schema: { "connect": string, "followup_1": string, "followup_2": string, "followup_3": string }

connect must be under 300 chars.
followup_1, followup_2 must be under 500 chars.
followup_3 must be under 300 chars (breakup / re-engage).
Tone: ${ctx.tone}.
Context: ${JSON.stringify(ctx)}`

  return runPrompt<LinkedInOutput>(prompt, 1000);
}

export async function generateFollowUps(ctx: PromptContext): Promise<FollowUp[]> {
  const prompt = `Return ONLY a JSON array. No explanation. No markdown.
Schema: Array of { "day": number, "subject": string, "body": string }
5 follow-ups. Days: 3, 7, 14, 21, 30.
Each body under 100 words. Each has a unique angle (do not repeat the original pitch).
Tone: ${ctx.tone}.
Context: ${JSON.stringify(ctx)}`

  return runPrompt<FollowUp[]>(prompt, 1500);
}
