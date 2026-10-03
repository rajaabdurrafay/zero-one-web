import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { decodeImage } from '../utils/uploads';

export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please try again shortly.' } });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication attempts. Please try again later.' } });
export const submissionLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, skip: req => req.method !== 'POST', message: { error: 'Too many submissions. Please try again later.' } });

// Validate all existing image-upload routes before they write files or change data.
export function validateImageUploads(req: Request, res: Response, next: NextFunction) {
  try {
    for (const field of ['imageBase64', 'avatarBase64', 'photoBase64', 'screenshotBase64', 'thumbnailBase64']) {
      if (req.body?.[field] !== undefined && req.body[field] !== '') decodeImage(req.body[field], field === 'photoBase64' || field === 'avatarBase64' ? 3 : 5);
    }
    if (req.path.endsWith('/upload-logo')) {
      for (const [field, allowed] of [['target', ['website', 'admin']], ['mode', ['light', 'dark']]] as const) {
        if (req.body?.[field] !== undefined && (typeof req.body[field] !== 'string' || !(allowed as readonly string[]).includes(req.body[field].toLowerCase()))) return res.status(400).json({ error: 'Invalid logo target or mode.' });
      }
    }
    next();
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid image.' }); }
}
