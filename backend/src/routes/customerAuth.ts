import { getUploadsRoot } from '../utils/uploadStorage';
import { saveLocalEmail } from '../utils/localEmail';
import { decodeImage } from '../utils/uploads';
import { canonicalPhone } from '@zeroone/domain';
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import { prisma } from '../db';
import { hashPassword, comparePassword, signToken, credentialTag } from '../utils/auth';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../middleware/customerAuth';

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().transform((value,ctx)=>{try{return canonicalPhone(value)}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Valid Pakistani mobile number is required'});return z.NEVER}}),
  email: z.string().email('Invalid email address').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  phone: signupSchema.shape.phone,
  password: z.string().min(1, 'Password is required').max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

// Normalize phone format (remove spaces, dashes)
function cleanPhone(raw: string): string {
  return canonicalPhone(raw);
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

    const accounts = await prisma.customer.findMany({where:{isRegistered:true,password:{not:null},OR:[{accountEmail:email},{email}]},take:2});
    if (accounts.length !== 1 || !accounts[0].email) return res.json(genericResponse);
    const customer = accounts[0];

    // Generate random reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
        resetTokenExpiry
      }
    });

    const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3002';
    const apiKey = process.env.RESEND_API_KEY;

    if (await saveLocalEmail({to: customer.email!, subject: 'Reset Your ZeroOne Password', text: `${websiteUrl}/reset-password?token=${resetToken}`})) {
      // The owner can open the local reset link from the private file outbox.
    } else if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        const delivery = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: customer.email!,
          subject: 'Reset Your ZeroOne Password',
          html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<a href="${websiteUrl}/reset-password?token=${resetToken}">Reset Password</a>`
        });
        if (delivery.error) throw new Error(delivery.error.message);
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
        resetToken: crypto.createHash('sha256').update(data.token).digest('hex'),
        isRegistered: true, password: {not:null},
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

    const hashedPassword = await hashPassword(data.newPassword);

    const resetResult = await prisma.customer.updateMany({
      where: { id: customer.id, resetToken: customer.resetToken, resetTokenExpiry: { gt: new Date() } },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        isRegistered: true,
        authVersion: {increment:1},
      }
    });

    if (resetResult.count !== 1) return res.status(400).json({ error: 'Reset link already used or expired.' });
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

    const variants = [phone,'0'+phone.slice(3),phone.slice(1),'00'+phone.slice(1)];
    const email = data.email?.trim().toLowerCase() || null;
    const existing = await prisma.customer.findFirst({where:{isRegistered:true,OR:[{accountPhone:phone},{phone:{in:variants}},...(email ? [{accountEmail:email},{email}] : [])]},select:{id:true}});
    if (existing) return res.status(409).json({error:'An account with this phone or email already exists. Please login.'});
    // Guest bookings remain separate until staff verifies their ownership.

    const hashedPassword = await hashPassword(data.password);

    const customer = await prisma.customer.create({
        data: {
          name: data.name.trim(),
          phone,
          accountPhone:phone,
          accountEmail:email,
          email,
          password: hashedPassword,
          isRegistered: true,
        }
      });

    const token = signToken({
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name,
      credentialTag: credentialTag(customer.password!),
      authVersion: customer.authVersion,
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
    if ((error as any)?.code === 'P2002') return res.status(409).json({error:'An account with this phone or email already exists.'});
    next(error);
  }
});

// POST /api/auth/login - Login with phone + password
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const phone = cleanPhone(data.phone);

    const variants=[phone,'0'+phone.slice(3),phone.slice(1),'00'+phone.slice(1)];
    const accounts=await prisma.customer.findMany({where:{isRegistered:true,password:{not:null},OR:[{accountPhone:phone},{phone:{in:variants}}]},take:2});
    const customer=accounts.length===1 ? accounts[0] : null;

    if (!customer || !customer.password) {
      return res.status(401).json({
        error: 'Invalid phone number or password.'
      });
    }

    const isValid = await comparePassword(data.password, customer.password);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid phone number or password.'
      });
    }

    if (!customer.accountPhone) {
      // Claim only this verified legacy account; never merge guest records automatically.
      await prisma.customer.update({where:{id:customer.id},data:{accountPhone:phone}});
    }
    if (!customer.password.startsWith('scrypt:')) {
      customer.password = await hashPassword(data.password);
      await prisma.customer.update({ where: { id: customer.id }, data: { password: customer.password } });
    }
    const token = signToken({
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name,
      credentialTag: credentialTag(customer.password!),
      authVersion: customer.authVersion,
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

// Logout revokes customer tokens across devices, even if a copied JWT remains.
router.post('/logout',requireCustomerAuth,async(req:AuthenticatedCustomerRequest,res,next)=>{
  try{await prisma.customer.update({where:{id:req.customer!.customerId},data:{authVersion:{increment:1}}});res.json({success:true});}catch(error){next(error)}
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
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/);
    if (match) {
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Profile photo exceeds 3MB limit.' });
    }

    const uploadsDir = path.join(getUploadsRoot(), 'avatars');
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
