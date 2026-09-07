export const APP_CONFIG = Object.freeze({
  siteUrl: 'https://hub.thesecretary.xyz',
  mainSiteUrl: 'https://thesecretary.xyz/',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwnvGL3hRBZnP7Hbc0Tr3Ev_A-LrSCTQN6gRXAGjqK5POBpIV4EnnW-fJkrCFnEHaIpqw/exec',
  authScriptUrl: 'https://script.google.com/macros/s/AKfycbyi2JzclUI1cx0vm0cqYwyN-urBEEE4Cr-Sm6FTBFj8i6tF3DUK5s42fH5yDN0T4dY7/exec',

  supabaseUrl: 'https://ubxgpkjuzkwlewofxmfy.supabase.co',
  supabasePublishableKey: 'sb_publishable_Nv7jtLPDojg2bKUAuMXlBw_T3MuegRF',

  adminEmail: 'dikshitaggarwal007@gmail.com',
});

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(APP_CONFIG.supabaseUrl)
  && APP_CONFIG.supabasePublishableKey.startsWith('sb_publishable_');

export const isAuthScriptConfigured = () =>
  /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(APP_CONFIG.authScriptUrl);
