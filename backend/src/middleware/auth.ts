import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/client.js';
import type { Plan } from '../types/index.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'Invalid token' });
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, credits')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Stub for now if profile doesn't exist yet (though trigger should handle it)
    req.user = {
      user_id: user.id,
      plan: 'free',
      credits: 10
    };
  } else {
    req.user = {
      user_id: user.id,
      plan: profile.plan as Plan,
      credits: profile.credits
    };
  }

  next();
};
