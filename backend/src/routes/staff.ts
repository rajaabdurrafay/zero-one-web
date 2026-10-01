import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { AdminRole } from '@prisma/client';
import { prisma } from '../db';
import { hashPassword } from '../utils/auth';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';
import { createAuditLog } from '../utils/auditLogger';

const router = Router();

// Helper to save base64 avatar image to /uploads/avatars
function saveAvatarFile(base64Data: string, prefix: string): string {
  let ext = 'jpg';
  const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (match) {
    ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Avatar image exceeds 5MB size limit.');
  }

  const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `staff_${prefix}_${Date.now()}.${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/avatars/${fileName}`;
}

// Protect all staff routes with SUPER_ADMIN requirement
router.use(requireAdminAuth([AdminRole.SUPER_ADMIN]));

const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  role: z.nativeEnum(AdminRole),
  avatarBase64: z.string().optional().nullable(),
});

const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(4).optional(),
  role: z.nativeEnum(AdminRole).optional(),
  isActive: z.boolean().optional(),
  avatarBase64: z.string().optional().nullable(),
});

// GET /api/admin/staff - List all staff accounts
router.get('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const staffMembers = await prisma.adminUser.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(staffMembers);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/staff - Create a new staff account
router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const data = createStaffSchema.parse(req.body);
    const username = data.username.trim().toLowerCase();

    // Check if username already exists
    const existing = await prisma.adminUser.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'A staff account with this username already exists.' });
    }

    let avatarUrl: string | null = null;
    if (data.avatarBase64 && data.avatarBase64.trim().length > 0) {
      try {
        avatarUrl = saveAvatarFile(data.avatarBase64, username);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Failed to process avatar image.' });
      }
    }

    const hashedPassword = hashPassword(data.password);

    const newStaff = await prisma.adminUser.create({
      data: {
        name: data.name.trim(),
        username,
        password: hashedPassword,
        avatarUrl,
        role: data.role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (req.admin?.id) {
      createAuditLog(req.admin.id, 'CREATE', 'STAFF', newStaff.id, {
        name: newStaff.name,
        username: newStaff.username,
        role: newStaff.role,
      });
    }

    return res.status(201).json({
      message: 'Staff account created successfully',
      staff: newStaff,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// PATCH /api/admin/staff/:id - Update staff account or toggle active status
router.patch('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.admin?.id;
    const data = updateStaffSchema.parse(req.body);

    const existingUser = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    // Safety guard: Super Admin cannot deactivate themselves
    if (existingUser.id === currentAdminId && data.isActive === false) {
      return res.status(400).json({
        error: 'Safety restriction: You cannot deactivate your own Super Admin account.',
      });
    }

    // Safety guard: Super Admin cannot demote their own role
    if (existingUser.id === currentAdminId && data.role && data.role !== AdminRole.SUPER_ADMIN) {
      return res.status(400).json({
        error: 'Safety restriction: You cannot demote your own Super Admin role.',
      });
    }

    // Check username conflict if username is being changed
    if (data.username && data.username.trim().toLowerCase() !== existingUser.username.toLowerCase()) {
      const conflict = await prisma.adminUser.findFirst({
        where: {
          username: {
            equals: data.username.trim(),
            mode: 'insensitive',
          },
        },
      });
      if (conflict) {
        return res.status(400).json({ error: 'Username is already taken by another account.' });
      }
    }

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name.trim();
    if (data.username) updatePayload.username = data.username.trim().toLowerCase();
    if (data.role) updatePayload.role = data.role;
    if (typeof data.isActive === 'boolean') updatePayload.isActive = data.isActive;
    if (data.password) updatePayload.password = hashPassword(data.password);

    if (data.avatarBase64 !== undefined) {
      if (data.avatarBase64 && data.avatarBase64.trim().length > 0) {
        try {
          updatePayload.avatarUrl = saveAvatarFile(data.avatarBase64, id);
        } catch (err: any) {
          return res.status(400).json({ error: err.message || 'Failed to process avatar image.' });
        }
      } else {
        updatePayload.avatarUrl = null;
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    });

    if (req.admin?.id) {
      createAuditLog(req.admin.id, 'UPDATE', 'STAFF', updated.id, {
        name: updated.name,
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        changes: Object.keys(updatePayload),
      });
    }

    return res.json({
      message: 'Staff account updated successfully',
      staff: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/admin/staff/:id - Delete a staff account
router.delete('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.admin?.id;

    if (id === currentAdminId) {
      return res.status(400).json({
        error: 'Safety restriction: You cannot delete your own account.',
      });
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    await prisma.adminUser.delete({
      where: { id },
    });

    if (req.admin?.id) {
      createAuditLog(req.admin.id, 'DELETE', 'STAFF', id, {
        deletedUsername: existing.username,
        deletedName: existing.name,
        role: existing.role,
      });
    }

    return res.json({ message: 'Staff account deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export { router as staffRouter };
