import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole, ThemeMode, ThemeTarget } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

export const DEFAULT_WEBSITE_THEME_DARK = {
  target: 'WEBSITE' as ThemeTarget,
  mode: 'DARK' as ThemeMode,
  primaryColor: '#8b5cf6',
  primaryDarkColor: '#6d28d9',
  accentColor: '#3b82f6',
  accentDarkColor: '#1d4ed8',
  backgroundColor: '#090d16',
  textColor: '#f8fafc',
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

export const DEFAULT_WEBSITE_THEME_LIGHT = {
  target: 'WEBSITE' as ThemeTarget,
  mode: 'LIGHT' as ThemeMode,
  primaryColor: '#7c3aed',
  primaryDarkColor: '#6d28d9',
  accentColor: '#2563eb',
  accentDarkColor: '#1d4ed8',
  backgroundColor: '#f8fafc',
  textColor: '#0f172a',
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

export const DEFAULT_ADMIN_THEME_DARK = {
  target: 'ADMIN' as ThemeTarget,
  mode: 'DARK' as ThemeMode,
  primaryColor: '#c9a84c',
  primaryDarkColor: '#e0c069',
  accentColor: '#6366f1',
  accentDarkColor: '#4338ca',
  backgroundColor: '#0b0b0c',
  textColor: '#ededeb',
  displayFont: 'Poppins',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

export const DEFAULT_ADMIN_THEME_LIGHT = {
  target: 'ADMIN' as ThemeTarget,
  mode: 'LIGHT' as ThemeMode,
  primaryColor: '#b48c36',
  primaryDarkColor: '#8a6518',
  accentColor: '#4f46e5',
  accentDarkColor: '#3730a3',
  backgroundColor: '#fbfaf6',
  textColor: '#1e1e24',
  displayFont: 'Poppins',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

const updateThemeSchema = z.object({
  target: z.enum(['WEBSITE', 'ADMIN']),
  mode: z.enum(['LIGHT', 'DARK']).default('DARK'),
  primaryColor: z.string().min(1),
  primaryDarkColor: z.string().min(1),
  accentColor: z.string().min(1),
  accentDarkColor: z.string().min(1),
  backgroundColor: z.string().min(1),
  textColor: z.string().min(1),
  displayFont: z.string().min(1).optional().default('Poppins'),
  bodyFont: z.string().min(1).optional().default('Inter'),
  baseSizeScale: z.number().min(0.5).max(2.0).optional().default(1.0),
  glassEffectEnabled: z.boolean().optional().default(false),
  logoUrlDark: z.string().nullable().optional(),
  logoUrlLight: z.string().nullable().optional(),
});

// GET /api/theme?target=WEBSITE|ADMIN&mode=LIGHT|DARK
router.get('/', async (req: Request, res: Response) => {
  try {
    const targetParam = (req.query.target as string)?.toUpperCase();
    const modeParam = (req.query.mode as string)?.toUpperCase();
    const target: ThemeTarget = targetParam === 'ADMIN' ? 'ADMIN' : 'WEBSITE';

    // Fetch all themes for this target from database
    const results = await prisma.themeSettings.findMany({
      where: {
        target,
      },
    });

    const darkDb = results.find((r) => r.mode === 'DARK');
    const lightDb = results.find((r) => r.mode === 'LIGHT');

    const darkDefault = target === 'ADMIN' ? DEFAULT_ADMIN_THEME_DARK : DEFAULT_WEBSITE_THEME_DARK;
    const lightDefault = target === 'ADMIN' ? DEFAULT_ADMIN_THEME_LIGHT : DEFAULT_WEBSITE_THEME_LIGHT;

    const darkTheme = darkDb ? { ...darkDb } : { ...darkDefault };
    const lightTheme = lightDb ? { ...lightDb } : { ...lightDefault };

    // If specific mode requested, return that mode
    if (modeParam === 'LIGHT') {
      return res.json({
        ...lightTheme,
        light: lightTheme,
        dark: darkTheme,
      });
    }

    if (modeParam === 'DARK') {
      return res.json({
        ...darkTheme,
        light: lightTheme,
        dark: darkTheme,
      });
    }

    // Default response contains active dark palette + nested light & dark objects
    return res.json({
      ...darkTheme,
      light: lightTheme,
      dark: darkTheme,
    });
  } catch (error) {
    console.error('Failed to get theme settings:', error);
    const targetParam = (req.query.target as string)?.toUpperCase();
    const target: ThemeTarget = targetParam === 'ADMIN' ? 'ADMIN' : 'WEBSITE';
    const darkDefault = target === 'ADMIN' ? DEFAULT_ADMIN_THEME_DARK : DEFAULT_WEBSITE_THEME_DARK;
    const lightDefault = target === 'ADMIN' ? DEFAULT_ADMIN_THEME_LIGHT : DEFAULT_WEBSITE_THEME_LIGHT;

    return res.json({
      ...darkDefault,
      light: lightDefault,
      dark: darkDefault,
    });
  }
});

// POST /api/theme/upload-logo - Super Admin only
router.post('/upload-logo', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { imageBase64, mode, target } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // Prepare uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'branding');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Strip metadata prefix if data uri
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let extension = 'png';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('svg')) extension = 'svg';
      else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
      else if (mime.includes('webp')) extension = 'webp';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    const targetSlug = (target || 'website').toLowerCase();
    const modeSlug = (mode || 'dark').toLowerCase();
    const uniqueName = `logo_${targetSlug}_${modeSlug}_${Date.now()}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const logoUrl = `/uploads/branding/${uniqueName}`;

    res.json({
      message: 'Logo uploaded successfully',
      logoUrl,
    });
  } catch (error) {
    console.error('Failed to upload branding logo:', error);
    res.status(500).json({ error: 'Failed to process logo upload' });
  }
});

// PUT /api/theme - Super Admin only
router.put('/', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const validatedData = updateThemeSchema.parse(req.body);

    const now = new Date();
    const newId = `theme_${validatedData.target.toLowerCase()}_${validatedData.mode.toLowerCase()}`;

    const updated = await prisma.themeSettings.upsert({
      where: {
        target_mode: {
          target: validatedData.target,
          mode: validatedData.mode,
        },
      },
      create: {
        id: newId,
        target: validatedData.target,
        mode: validatedData.mode,
        primaryColor: validatedData.primaryColor,
        primaryDarkColor: validatedData.primaryDarkColor,
        accentColor: validatedData.accentColor,
        accentDarkColor: validatedData.accentDarkColor,
        backgroundColor: validatedData.backgroundColor,
        textColor: validatedData.textColor,
        displayFont: validatedData.displayFont,
        bodyFont: validatedData.bodyFont,
        baseSizeScale: validatedData.baseSizeScale,
        glassEffectEnabled: validatedData.glassEffectEnabled,
        logoUrlDark: validatedData.logoUrlDark ?? null,
        logoUrlLight: validatedData.logoUrlLight ?? null,
      },
      update: {
        primaryColor: validatedData.primaryColor,
        primaryDarkColor: validatedData.primaryDarkColor,
        accentColor: validatedData.accentColor,
        accentDarkColor: validatedData.accentDarkColor,
        backgroundColor: validatedData.backgroundColor,
        textColor: validatedData.textColor,
        displayFont: validatedData.displayFont,
        bodyFont: validatedData.bodyFont,
        baseSizeScale: validatedData.baseSizeScale,
        glassEffectEnabled: validatedData.glassEffectEnabled,
        logoUrlDark: validatedData.logoUrlDark ?? null,
        logoUrlLight: validatedData.logoUrlLight ?? null,
      },
    });

    res.json({
      message: `${validatedData.target} ${validatedData.mode} mode theme updated successfully`,
      theme: updated || validatedData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update theme settings:', error);
    res.status(500).json({ error: 'Failed to update theme settings' });
  }
});

export { router as themeRouter };
