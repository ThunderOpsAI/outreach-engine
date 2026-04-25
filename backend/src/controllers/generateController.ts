import type { Request, Response } from 'express'
import { z } from 'zod'
import type { GenerateRequest, GenerateResponse, GatewayError, UserContext } from '../types/index.js'
import { checkAndDeductCredit, refundCredit } from '../services/credits.js'
import { enrichCompany } from '../services/enrichment.js'
import { buildPromptContext } from '../services/personaliser.js'
import { generateEmail, generateLinkedIn, generateFollowUps, GenerationError } from '../services/generator.js'
import { supabase } from '../db/client.js'

const GenerateSchema = z.object({
  company_name: z.string().min(2).max(100),
  offer: z.string().min(5).max(500),
  company_url: z.string().url().optional(),
  target_name: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  tone: z.enum(['casual', 'formal', 'direct']).optional().default('direct'),
  template_id: z.string().uuid().optional()
})

export async function generateOutreach(req: Request, res: Response) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;
  const user = (req as any).user as UserContext;

  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'User context missing', request_id: requestId } as GatewayError);
  }

  // 1. Validate request
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid request body', request_id: requestId } as GatewayError);
  }

  const payload = parsed.data as GenerateRequest;

  // 2. Check and deduct credits
  let creditsRemaining = user.credits;
  try {
    creditsRemaining = await checkAndDeductCredit(user.user_id, user.plan);
  } catch (err: any) {
    if (err.code === 'NO_CREDITS') {
      return res.status(402).json({ code: 'NO_CREDITS', message: err.message, request_id: requestId } as GatewayError);
    }
    return res.status(500).json({ code: 'SERVICE_UNAVAILABLE', message: 'Failed to check credits', request_id: requestId } as GatewayError);
  }

  const dummyProjectId = crypto.randomUUID(); // Temporarily generate one for potential refund

  try {
    // 3. Run enrichment
    let enrichmentResult = undefined;
    let enrichmentUsed = false;
    if (payload.company_url) {
      enrichmentResult = await enrichCompany(payload.company_url);
      if (enrichmentResult && enrichmentResult.industry !== 'Unknown') {
        enrichmentUsed = true;
      }
    }

    // 4. Build prompt context
    const ctx = buildPromptContext(payload, enrichmentResult);

    // 5. Run generator
    const [emailRes, linkedinRes, followupsRes] = await Promise.allSettled([
      generateEmail(ctx),
      generateLinkedIn(ctx),
      generateFollowUps(ctx)
    ]);

    let emailOutput = emailRes.status === 'fulfilled' ? emailRes.value : null;
    let linkedinOutput = linkedinRes.status === 'fulfilled' ? linkedinRes.value : null;
    let followupsOutput = followupsRes.status === 'fulfilled' ? followupsRes.value : null;

    if (!emailOutput && !linkedinOutput && !followupsOutput) {
      throw new GenerationError('All generation models failed');
    }

    // Since types require output, we'll provide fallbacks if some failed
    if (!emailOutput) {
      emailOutput = { subjects: ['Error', 'Error', 'Error'], body_short: 'Error', body_long: 'Error' };
    }
    if (!linkedinOutput) {
      linkedinOutput = { connect: 'Error', followup_1: 'Error', followup_2: 'Error', followup_3: 'Error' };
    }
    if (!followupsOutput) {
      followupsOutput = [];
    }

    const output = {
      email: emailOutput,
      linkedin: linkedinOutput,
      followups: followupsOutput
    };

    const response: GenerateResponse = {
      request_id: requestId,
      project_id: dummyProjectId,
      enrichment_used: enrichmentUsed,
      generation_time_ms: Date.now() - startTime,
      output,
      credits_remaining: creditsRemaining
    };

    // 6. Save project + messages (async)
    setImmediate(async () => {
      try {
        const { data: project } = await supabase.from('projects').insert({
          id: dummyProjectId,
          user_id: user.user_id,
          company_name: payload.company_name,
          company_url: payload.company_url,
          offer: payload.offer,
          enrichment: enrichmentResult
        }).select('id').single();

        if (project) {
          const messages = [];
          if (emailRes.status === 'fulfilled') {
            messages.push({ project_id: project.id, type: 'email', content: JSON.stringify(emailRes.value) });
          }
          if (linkedinRes.status === 'fulfilled') {
            messages.push({ project_id: project.id, type: 'linkedin', content: JSON.stringify(linkedinRes.value) });
          }
          if (followupsRes.status === 'fulfilled') {
            messages.push({ project_id: project.id, type: 'followups', content: JSON.stringify(followupsRes.value) });
          }

          if (messages.length > 0) {
            await supabase.from('messages').insert(messages);
          }
        }
      } catch (err) {
        console.error('Failed to save project/messages asynchronously', err);
      }
    });

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Generation-Time-Ms', response.generation_time_ms.toString());

    // 7. Return response
    return res.status(200).json(response);

  } catch (err) {
    console.error('Generation pipeline failed', err);
    // Refund credit on generation error
    if (user.plan !== 'agency') {
      await refundCredit(user.user_id, dummyProjectId).catch(e => console.error('Refund failed', e));
    }
    if (err instanceof GenerationError) {
      return res.status(503).json({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Generation provider is currently unavailable',
        request_id: requestId,
      } as GatewayError);
    }

    return res.status(500).json({ code: 'GENERATION_FAILED', message: 'Generation failed', request_id: requestId } as GatewayError);
  }
}
