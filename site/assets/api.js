import { APP_CONFIG } from './config.js';
import { supabase } from './supabase-client.js';

const publicActions = new Set(['status', 'archive', 'content', 'subscribe', 'unsubscribe']);

export async function statusApi(action = 'status', data = {}) {
  const payload = { action, ...data };
  let response;
  if (publicActions.has(action)) {
    const url = new URL(APP_CONFIG.appsScriptUrl);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, String(value ?? '')));
    response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  } else {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Administrator login required.');
    payload.access_token = token;
    response = await fetch(APP_CONFIG.appsScriptUrl, {
      method: 'POST',
      body: new URLSearchParams(payload),
      redirect: 'follow',
    });
  }
  if (!response.ok) throw new Error(`Status backend returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.ok) {
    if (/^unauthorized\.?$/i.test(String(result.error || '').trim())) {
      throw new Error('The deployed Apps Script backend is outdated. Publish the current Code.gs as a new web-app version.');
    }
    throw new Error(result.error || 'Status backend request failed.');
  }
  return result;
}
