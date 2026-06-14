// js/auth.js
// Authentication service functions — Phase 4 implementation.
import { supabase } from './supabase.js';

export async function signUp(email, password, firstName, lastName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) throw error;

  // Upsert into user_profiles after signup.
  // NOTE: PK column is 'id' (not 'user_id') — schema correction from critical research.
  // Catch separately: auth succeeded even if profile upsert fails.
  if (data.user) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        { id: data.user.id, first_name: firstName, last_name: lastName, email },
        { onConflict: 'id' }
      );
    if (profileError) {
      console.warn('Profile upsert failed (auth still succeeded):', profileError.message);
    }
  }

  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return subscription;
}

// Expose on window so Alpine inline x-data expressions can call these.
// Alpine x-data strings run in global scope — cannot use ES module imports.
window.signIn = signIn;
window.signUp = signUp;
window.elvoraSignOut = signOut; // Use elvoraSignOut to avoid global naming conflicts (RESEARCH Finding 11)
