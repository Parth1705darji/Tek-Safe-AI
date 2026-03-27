/**
 * Admin audit log helper.
 *
 * Every mutating admin action (role changes, KB creates/updates/deletes)
 * writes a row here. Non-fatal: a log failure never blocks the real operation.
 */

export interface AuditEntry {
  adminClerkId: string;
  adminEmail: string;
  /** e.g. 'set_role' | 'create_kb' | 'update_kb' | 'delete_kb' */
  action: string;
  /** e.g. 'user' | 'kb_document' */
  targetType?: string;
  /** The DB id or Clerk id of the affected resource */
  targetId?: string;
  /** What changed — kept for forensics */
  payload?: Record<string, unknown>;
  /** Best-effort IP from x-forwarded-for */
  ipAddress?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAuditLog(supabase: any, entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_clerk_id: entry.adminClerkId,
      admin_email: entry.adminEmail,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      payload: entry.payload ?? null,
      ip_address: entry.ipAddress ?? null,
    });
  } catch (e) {
    console.warn('Audit log write failed (non-fatal):', (e as Error).message);
  }
}
