import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import { prisma } from '../db';
import { hashPassword, comparePassword, signToken } from '../utils/auth';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../middleware/customerAuth';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid mobile number is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
});

// Normalize phone format (remove spaces, dashes)
function cleanPhone(raw: string): string {
  return raw.replace(/[\s\-]/g, '');
}

// POST /api/auth/forgot-password - Request password reset link via Resend email
router.post('/forgot-password', async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();

    // Generic response to prevent email enumeration
    const genericResponse = {
      message: 'If this email is registered, a password reset link has been sent to it.'
    };

    const customer = await prisma.customer.findFirst({
      where: {
        email: {
          equals: email
        }
      }
    });

    if (!customer || !customer.email) {
      return res.json(genericResponse);
    }

    // Generate random reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3002';
    const apiKey = process.env.RESEND_API_KEY;

    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: customer.email,
          subject: 'Reset Your ZeroOne Password',
          html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<a href="${websiteUrl}/reset-password?token=${resetToken}">Reset Password</a>`
        });
      } catch (emailErr) {
        console.error('Failed to dispatch password reset email via Resend:', emailErr);
      }
    } else {
      console.warn('RESEND_API_KEY is not defined in backend/.env. Password reset email skipped.');
    }

    return res.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// POST /api/auth/reset-password - Reset password using valid token
router.post('/reset-password', async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: {
        resetToken: data.token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!customer) {
      return res.status(400).json({
        error: 'This link has expired or is invalid. Please request a new one.'
      });
    }

    const hashedPassword = hashPassword(data.newPassword);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        isRegistered: true,
      }
    });

    res.json({
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// POST /api/auth/signup - Register new customer account
router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const phone = cleanPhone(data.phone);

    // Check if customer with this phone already exists
    const existing = await prisma.customer.findFirst({
      where: { phone }
    });

    if (existing && existing.isRegistered && existing.password) {
      return res.status(400).json({
        error: 'An account with this mobile number already exists. Please login instead.'
      });
    }

    const hashedPassword = hashPassword(data.password);

    let customer;
    if (existing) {
      // Upgrade existing guest customer to registered
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: data.name.trim(),
          email: data.email ? data.email.trim() : (existing.email || null),
          password: hashedPassword,
          isRegistered: true,
        }
      });
    } else {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          name: data.name.trim(),
          phone,
          email: data.email ? data.email.trim() : null,
          password: hashedPassword,
          isRegistered: true,
        }
      });
    }

    const token = signToken({
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name
    });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        profilePictureUrl: customer.profilePictureUrl || null,
        isRegistered: customer.isRegistered
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// POST /api/auth/login - Login with phone + password
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const phone = cleanPhone(data.phone);

    const customer = await prisma.customer.findFirst({
      where: { phone }
    });

    if (!customer || !customer.password) {
      return res.status(401).json({
        error: 'No registered account found with this phone number. Please sign up.'
      });
    }

    const isValid = comparePassword(data.password, customer.password);
    if (!isValid) {
      return res.status(401).json({
        error: 'Incorrect password. Please try again.'
      });
    }

    const token = signToken({
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name
    });

    res.json({
      message: 'Login successful',
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        profilePictureUrl: customer.profilePictureUrl || null,
        isRegistered: customer.isRegistered
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// GET /api/auth/me - Current customer profile
router.get('/me', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer!.customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profilePictureUrl: true,
        isRegistered: true,
        createdAt: true,
        _count: {
          select: { bookings: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/profile-picture - Upload profile picture (Base64)
const profilePictureSchema = z.object({
  photoBase64: z.string().min(1, 'Photo data is required'),
});

router.post('/profile-picture', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customerId = req.customer!.customerId;
    const body = profilePictureSchema.parse(req.body);

    let base64Data = body.photoBase64;
    let ext = 'jpg';
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (match) {
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Profile photo exceeds 3MB limit.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `avatar_${customerId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const profilePictureUrl = `/uploads/avatars/${fileName}`;

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: { profilePictureUrl },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profilePictureUrl: true,
        isRegistered: true,
      }
    });

    res.json({
      message: 'Profile picture updated successfully',
      profilePictureUrl,
      customer: updatedCustomer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid profile photo data', details: error.errors });
    }
    next(error);
  }
});

export { router as customerAuthRouter };
