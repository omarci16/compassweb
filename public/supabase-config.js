/* =========================================================
   Compass Systems — Supabase configuration
   ---------------------------------------------------------
   Fill in the three values below once (see SUPABASE_SETUP.md).
   This file is safe to commit: the anon key is a PUBLIC key.
   Real protection comes from Row Level Security + Supabase Auth
   (the admin signs in; the public can only insert inquiries and
   read published posts). Never put the service_role key here.
   ========================================================= */
window.COMPASS_SUPABASE = {
  // Project URL, e.g. https://abcdefgh.supabase.co
  url: 'YOUR_SUPABASE_URL',
  // Public anon key (Project Settings → API → anon public)
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
  // Public storage bucket for blog cover images
  bucket: 'blog-covers'
};

/* True only once real values are pasted in — used by the public
   site to decide whether to call Supabase or fall back gracefully. */
window.COMPASS_SUPABASE.ready = (function (c) {
  return !!c.url && c.url.indexOf('YOUR_') !== 0 &&
         !!c.anonKey && c.anonKey.indexOf('YOUR_') !== 0;
})(window.COMPASS_SUPABASE);
