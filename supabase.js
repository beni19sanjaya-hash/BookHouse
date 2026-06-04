/**
 * BookHouse — supabase.js
 * Konfigurasi dan helper untuk koneksi ke Supabase
 */

const SUPABASE_URL = 'https://cgfpespwcsumjvnmbbvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZnBlc3B3Y3N1bWp2bm1iYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTQ2MzUsImV4cCI6MjA5NjA5MDYzNX0.HHafEbXprUfIGFmiTnYg8iE-cu2i21ldRZrZnNIc8TY';

// Inisialisasi Supabase client menggunakan CDN
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  AUTH HELPERS
// ============================================================

async function sbSignUp(email, password, metadata) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  return { data, error };
}

async function sbSignIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function sbSignOut() {
  const { error } = await sb.auth.signOut();
  return { error };
}

async function sbGetSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ============================================================
//  DATABASE HELPERS
// ============================================================

// -- BOOKS --
async function dbGetBooks() {
  const { data, error } = await sb.from('books').select('*').order('id');
  if (error) { console.error('Error getBooks:', error); return []; }
  return data;
}

async function dbGetBook(id) {
  const { data, error } = await sb.from('books').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function dbInsertBook(book) {
  const { data, error } = await sb.from('books').insert([book]).select().single();
  return { data, error };
}

async function dbUpdateBook(id, updates) {
  const { data, error } = await sb.from('books').update(updates).eq('id', id).select().single();
  return { data, error };
}

async function dbDeleteBook(id) {
  const { error } = await sb.from('books').delete().eq('id', id);
  return { error };
}

// -- CATEGORIES --
async function dbGetCategories() {
  const { data, error } = await sb.from('categories').select('*').order('id');
  if (error) { console.error('Error getCategories:', error); return []; }
  return data;
}

async function dbInsertCategory(cat) {
  // mapping: field 'desc' di JS -> 'description' di DB
  if (cat.desc !== undefined) { cat.description = cat.desc; delete cat.desc; }
  const { data, error } = await sb.from('categories').insert([cat]).select().single();
  return { data, error };
}

async function dbUpdateCategory(id, updates) {
  if (updates.desc !== undefined) { updates.description = updates.desc; delete updates.desc; }
  const { data, error } = await sb.from('categories').update(updates).eq('id', id).select().single();
  return { data, error };
}

async function dbDeleteCategory(id) {
  const { error } = await sb.from('categories').delete().eq('id', id);
  return { error };
}

// -- PROFILES (data tambahan user) --
async function dbGetProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

async function dbInsertProfile(profile) {
  const { data, error } = await sb.from('profiles').insert([profile]).select().single();
  return { data, error };
}

async function dbGetAllProfiles() {
  const { data, error } = await sb.from('profiles').select('*').order('created_at');
  if (error) { console.error('Error getProfiles:', error); return []; }
  return data;
}

async function dbDeleteProfile(userId) {
  const { error } = await sb.from('profiles').delete().eq('id', userId);
  return { error };
}

// -- BORROWS --
async function dbGetBorrows(userId = null) {
  let query = sb.from('borrows').select('*').order('borrow_date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) { console.error('Error getBorrows:', error); return []; }
  return data;
}

async function dbGetBorrow(id) {
  const { data, error } = await sb.from('borrows').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function dbInsertBorrow(borrow) {
  const { data, error } = await sb.from('borrows').insert([borrow]).select().single();
  return { data, error };
}

async function dbUpdateBorrow(id, updates) {
  const { data, error } = await sb.from('borrows').update(updates).eq('id', id).select().single();
  return { data, error };
}

// -- FAVOURITES --
async function dbGetFavourites(userId) {
  const { data, error } = await sb.from('favourites').select('book_id').eq('user_id', userId);
  if (error) return [];
  return data.map(f => f.book_id);
}

async function dbToggleFavourite(userId, bookId) {
  // Cek apakah sudah ada
  const { data: existing } = await sb.from('favourites').select('id').eq('user_id', userId).eq('book_id', bookId).single();
  if (existing) {
    await sb.from('favourites').delete().eq('user_id', userId).eq('book_id', bookId);
    return false; // dihapus
  } else {
    await sb.from('favourites').insert([{ user_id: userId, book_id: bookId }]);
    return true; // ditambahkan
  }
}

// ============================================================
//  STORAGE HELPERS (untuk upload foto KTP)
// ============================================================

async function uploadIdPhoto(userId, borrowId, dataUrl) {
  // Convert base64 ke blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.split('/')[1] || 'jpg';
  const filePath = `${userId}/${borrowId}.${ext}`;

  const { data, error } = await sb.storage.from('id-photos').upload(filePath, blob, {
    contentType: blob.type,
    upsert: true,
  });

  if (error) { console.error('Upload error:', error); return null; }

  const { data: urlData } = sb.storage.from('id-photos').getPublicUrl(filePath);
  return urlData.publicUrl;
}
