export const APP_CONFIG = Object.freeze({
  siteUrl: 'https://the-secretary-status.github.io',
  mainSiteUrl: 'https://thesecretary.xyz/',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwXryWaU-Chu_Z_lRfslI7w9Stz043rVs0IoqRD4HAuhx2AWHstHf6CIqWLCpS_AUN3CQ/exec',

  // Supabase Dashboard -> Project Settings -> API.
  // The project URL is still required before accounts/community can connect.
  supabaseUrl: 'https://ubxgpkjuzkwlewofxmfy.supabase.co',
  supabasePublishableKey: 'sb_publishable_Nv7jtLPDojg2bKUAuMXlBw_T3MuegRF',

  adminEmail: 'dikshitaggarwal007@gmail.com',
});

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(APP_CONFIG.supabaseUrl)
  && APP_CONFIG.supabasePublishableKey.startsWith('sb_publishable_');
