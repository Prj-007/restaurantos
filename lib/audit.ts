import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

// Fire-and-forget activity logging for the audit trail. Never throws into
// the caller — a logging failure should never break the underlying action.
export async function logActivity(
  session: SessionPayload,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        actorName: session.name,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
