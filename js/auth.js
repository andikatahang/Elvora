// js/auth.js
// Authentication service functions — username-based auth.
// Supabase Auth requires email internally; we generate "{username}@elvora.local"
// transparently so users only ever interact with their chosen username.
import { supabase } from './supabase.js';

function toSyntheticEmail(username) {
  return `${username.toLowerCase().trim()}@elvora.local`;
}

export async function signUp(username, password, firstName, lastName) {
  const email = toSyntheticEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName, username } },
  });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        { id: data.user.id, first_name: firstName, last_name: lastName, username },
        { onConflict: 'id' }
      );
    if (profileError) {
      console.warn('Profile upsert failed (auth still succeeded):', profileError.message);
    }
  }

  return data;
}

export async function signIn(username, password) {
  const email = toSyntheticEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
  const redirectTo = isLocal
    ? 'https://elvorastudio.netlify.app/account.html'
    : `${window.location.origin}/account.html`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
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
window.signIn = signIn;
window.signUp = signUp;
window.signInWithGoogle = signInWithGoogle;
window.elvoraSignOut = signOut;
