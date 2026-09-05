/**
 * CIVICAI: Supabase Client Adapter
 * Handles real Supabase PostgreSQL DB, Auth, Storage, and Realtime subscriptions
 */

import { CONFIG } from './config.js';

let supabaseInstance = null;
let isConnectedToLiveSupabase = false;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const url = CONFIG.SUPABASE.URL;
  const key = CONFIG.SUPABASE.ANON_KEY;

  if (window.supabase && url && key && !url.includes('xyzcompany')) {
    try {
      supabaseInstance = window.supabase.createClient(url, key);
      isConnectedToLiveSupabase = true;
      console.log('✅ CivicAI: Connected to Live Supabase Backend');
    } catch (e) {
      console.warn('⚠️ CivicAI: Could not initialize Live Supabase client, using robust storage engine fallback.', e);
      isConnectedToLiveSupabase = false;
    }
  } else {
    isConnectedToLiveSupabase = false;
  }

  return supabaseInstance;
}

export function isLiveSupabase() {
  return isConnectedToLiveSupabase;
}

export async function uploadImageToSupabase(file, bucket = 'civic-reports') {
  const sb = getSupabase();
  if (!sb || !isLiveSupabase()) {
    // Return Base64 or Blob Data URL for offline / local-first storage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  try {
    const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error: uploadError } = await sb.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (uploadError) throw uploadError;

    const { data } = sb.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Supabase Storage upload failed, falling back to DataURL:', error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }
}
