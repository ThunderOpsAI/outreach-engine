import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/client.js';
import type { UserContext } from '../types/index.js';

const router = Router();

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  tone: z.enum(['casual', 'formal', 'direct']).optional().default('direct'),
  structure: z.record(z.string(), z.any())
});

router.get('/', async (req, res) => {
  const user = (req as any).user as UserContext;
  
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'User context missing' });
  }

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', user.user_id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
  }

  res.status(200).json(data);
});

router.post('/', async (req, res) => {
  const user = (req as any).user as UserContext;
  
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'User context missing' });
  }

  const parsed = CreateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Invalid request body' });
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      user_id: user.user_id,
      name: parsed.data.name,
      tone: parsed.data.tone,
      structure: parsed.data.structure
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
  }

  res.status(201).json(data);
});

router.delete('/:id', async (req, res) => {
  const user = (req as any).user as UserContext;
  const { id } = req.params;
  
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORISED', message: 'User context missing' });
  }

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.user_id);

  if (error) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
  }

  res.status(204).send();
});

export default router;
