'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginFormData, RegisterFormData } from '../types';

export async function login(data: LoginFormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    // Don't expose detailed error messages for security
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Invalid email or password' };
    }
    return { error: 'Login failed. Please try again.' };
  }

  // Success: no error
  return { error: null };
}

export async function register(data: RegisterFormData) {
  const supabase = await createClient();

  // Basic validation
  if (!data.email || !data.password || !data.name) {
    return { error: 'All fields are required' };
  }

  if (data.password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        name: data.name,
      },
    },
  });

  if (error) {
    // Handle specific error cases without exposing internal details
    if (error.message.includes('already registered')) {
      return { error: 'An account with this email already exists' };
    }
    if (error.message.includes('Invalid email')) {
      return { error: 'Please enter a valid email address' };
    }
    return { error: 'Registration failed. Please try again.' };
  }

  // Success: no error
  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: 'Logout failed. Please try again.' };
  }
  return { error: null };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
