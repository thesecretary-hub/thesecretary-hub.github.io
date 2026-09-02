export const APP_CONFIG = Object.freeze({
  siteUrl: 'https://the-secretary-status.github.io',
  mainSiteUrl: 'https://thesecretary.xyz/',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwBlZnqbg7K8emJjApBDJWOJ_fM2_fJ-xztrvwDkOl5EH8soea-atPY48s9p2bu1YhcbQ/exec',

  supabaseUrl: 'https://ubxgpkjuzkwlewofxmfy.supabase.co',
  supabasePublishableKey: 'sb_publishable_Nv7jtLPDojg2bKUAuMXlBw_T3MuegRF',

  adminEmail: 'dikshitaggarwal007@gmail.com',
});

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(APP_CONFIG.supabaseUrl)
  && APP_CONFIG.supabasePublishableKey.startsWith('sb_publishable_');
