import type { Plan, GatewayError } from '../types/index.js'
import { supabase } from '../db/client.js'

export async function checkAndDeductCredit(userId: string, plan: Plan): Promise<number> {
  if (plan === 'agency') {
    return 999999; // Unlimited
  }

  const { data, error } = await supabase.rpc('decrement_credit', { user_id: userId })

  if (error) {
    if (error.message.includes('NO_CREDITS')) {
      throw { code: 'NO_CREDITS', message: 'No credits remaining' } as GatewayError
    }
    throw new Error(`Failed to deduct credit: ${error.message}`)
  }

  const newCredits = data as number;

  await supabase.from('credit_events').insert({
    user_id: userId,
    delta: -1,
    reason: 'generation'
  })

  return newCredits;
}

export async function refundCredit(userId: string, projectId: string): Promise<void> {
  const { data, error } = await supabase.rpc('increment_credit', { user_id: userId })
  
  if (error) {
    // Fallback if increment_credit doesn't exist, we can manually increment, though it might not be atomic.
    // For now we'll do an update. Wait, we can just do a normal update.
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({ credits: profile.credits + 1 }).eq('id', userId);
    }
  }

  await supabase.from('credit_events').insert({
    user_id: userId,
    delta: 1,
    reason: 'refund',
    project_id: projectId
  })
}
