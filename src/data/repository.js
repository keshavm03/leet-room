import { LocalRepository } from './localRepository.js';
import { SupabaseRepository } from './supabaseRepository.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isOnlineConfigured = Boolean(url && anonKey && !url.includes('your-project'));
export const repository = isOnlineConfigured
  ? new SupabaseRepository(url, anonKey)
  : new LocalRepository();
