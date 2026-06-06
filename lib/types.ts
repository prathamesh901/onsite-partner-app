/** User role returned by GET /api/auth/me. */
export type UserRole = 'admin' | 'partner' | 'staff' | string;

/** Account approval status returned by GET /api/auth/me. */
export type UserStatus = 'approved' | 'pending' | 'rejected' | 'suspended' | string;

/** Profile shape from GET /api/auth/me. Extra fields are tolerated. */
export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  [key: string]: unknown;
}
