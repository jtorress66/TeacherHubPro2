import 'server-only';
import type { AuditAction, SchoolId, User } from '@thp/domain';
import { getAppContainer } from '../../container.ts';

/** Adds a line to the school's activity log after a change went through. */
export async function record(
  actor: User,
  action: AuditAction,
  targetId?: string,
  schoolId?: SchoolId,
): Promise<void> {
  await getAppContainer().recordActivity.execute({
    actor,
    action,
    ...(targetId === undefined ? {} : { targetId }),
    ...(schoolId === undefined ? {} : { schoolId }),
  });
}
