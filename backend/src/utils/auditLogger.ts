import { prisma } from '../db';

/**
 * Creates an audit log entry in a non-blocking asynchronous manner.
 * Note: Errors within this function are caught and logged to the console
 * to prevent the primary operation (e.g. creating/updating entities) from failing.
 *
 * @param staffId - ID of the admin user performing the action
 * @param action - Action verb (e.g. 'CREATE', 'UPDATE', 'DELETE', 'VERIFY')
 * @param entity - The entity being modified (e.g. 'BOOKING', 'STAFF', 'SETTINGS')
 * @param entityId - (Optional) ID of the modified entity
 * @param details - (Optional) JSON-serializable object with context (old values, new values, etc)
 */
export async function createAuditLog(
  staffId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, any> | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        staffId,
        action,
        entity,
        entityId: entityId || null,
        details: details ? (details as any) : undefined,
      },
    });
  } catch (error) {
    // Only log the error; do not throw it to avoid breaking the calling request.
    console.error('Failed to create audit log:', error);
  }
}
