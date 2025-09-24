import { createClient } from '@/lib/supabase/server';

// List of admin user emails - in production, this should be in a database
const ADMIN_EMAILS = [
  'admin@example.com',
  // Add more admin emails here
];

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return false;
    }

    return ADMIN_EMAILS.includes(user.email);
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<{ error?: string; isAdmin: boolean }> {
  const adminCheck = await isAdmin();
  
  if (!adminCheck) {
    return { error: 'Unauthorized: Admin access required', isAdmin: false };
  }
  
  return { isAdmin: true };
}