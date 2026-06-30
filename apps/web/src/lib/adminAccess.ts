import { auth } from '@/lib/api';

export type MeUser = { id?: string; email?: string; name?: string; isAdmin?: boolean };

/** Returns true only for platform administrators (THEE_MICHAEL authorized emails). */
export async function checkPlatformAdmin(): Promise<boolean> {
  try {
    const me = await auth.me() as { user?: MeUser };
    return !!me.user?.isAdmin;
  } catch {
    return false;
  }
}