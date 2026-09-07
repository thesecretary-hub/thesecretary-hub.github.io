import { APP_CONFIG, isAuthScriptConfigured } from './config.js';

export async function authApi(action, data = {}) {
  if (!isAuthScriptConfigured()) {
    throw new Error('Account verification is waiting for the new Apps Script deployment URL.');
  }
  const response = await fetch(APP_CONFIG.authScriptUrl, {
    method: 'POST',
    body: new URLSearchParams({action, ...data}),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Account service returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'The account service could not complete this request.');
  return result;
}
