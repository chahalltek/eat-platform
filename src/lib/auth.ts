export type AppUser = {
  id: string;
  email: string;
  role: 'recruiter' | 'admin' | 'hiring_manager';
};

export function getCurrentUser(): AppUser {
  // TEMPORARY stub implementation for MVP
  return {
    id: 'charlie',
    email: 'charlie@strategicsystems.io',
    role: 'recruiter',
  };
}
