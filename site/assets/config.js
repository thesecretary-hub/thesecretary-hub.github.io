export const APP_CONFIG = Object.freeze({
  siteUrl: 'https://hub.thesecretary.xyz',
  mainSiteUrl: 'https://thesecretary.xyz/',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwnvGL3hRBZnP7Hbc0Tr3Ev_A-LrSCTQN6gRXAGjqK5POBpIV4EnnW-fJkrCFnEHaIpqw/exec',

  supabaseUrl: 'https://ubxgpkjuzkwlewofxmfy.supabase.co',
  supabasePublishableKey: 'sb_publishable_Nv7jtLPDojg2bKUAuMXlBw_T3MuegRF',

  adminEmail: 'dikshitaggarwal007@gmail.com',
});

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(APP_CONFIG.supabaseUrl)
  && APP_CONFIG.supabasePublishableKey.startsWith('sb_publishable_');
