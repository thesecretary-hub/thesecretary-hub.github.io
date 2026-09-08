import { authApi } from './auth-api.js';
import { requireSupabase, supabase } from './supabase-client.js';
import { mountLayout, showToast } from './layout.js?v=3.1.0';

await mountLayout('');

const mode = document.body.dataset.auth;
const errorBox = document.querySelector('[data-auth-error]');
const panels = [...document.querySelectorAll('[data-auth-panel]')];
let pendingRegistration = null;
let resetEmail = '';
let resetTicket = '';

function fail(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
  errorBox.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function showPanel(name) {
  clearError();
  panels.forEach(panel => { panel.hidden = panel.dataset.authPanel !== name; });
  panels.find(panel => !panel.hidden)?.querySelector('input')?.focus();
}

function redirectAfterAuth() {
  const returnTo = new URLSearchParams(location.search).get('return');
  location.href = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
}

async function signIn(identifier, password) {
  const client = requireSupabase();
  identifier = identifier.trim().toLowerCase();
  if (identifier.includes('@')) {
    const { error } = await client.auth.signInWithPassword({email:identifier,password});
    if (error) throw error;
    return;
  }
  const { data, error } = await client.functions.invoke('login-identifier', {body:{identifier,password}});
  if (error) {
    let functionMessage = data?.error || '';
    try {
      if (!functionMessage && error.context instanceof Response) functionMessage = (await error.context.clone().json())?.error || '';
    } catch (_) {}
    throw new Error(functionMessage || error.message || 'Login failed.');
  }
  if (data?.error || !data?.session) throw new Error(data?.error || 'Login failed.');
  const { error: sessionError } = await client.auth.setSession({
    access_token:data.session.access_token,
    refresh_token:data.session.refresh_token,
  });
  if (sessionError) throw sessionError;
}

async function submitForm(form, action) {
  clearError();
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.classList.add('is-loading');
  try {
    const values = Object.fromEntries(new FormData(form));
    if (action === 'login') {
      await signIn(values.identifier, values.password);
      redirectAfterAuth();
    }
    if (action === 'register') {
      if (values.password !== values.password_confirm) throw new Error('The passwords do not match.');
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(values.username)) throw new Error('Username must use 3–32 letters, numbers, or underscores.');
      pendingRegistration = {
        email:values.email.trim().toLowerCase(),
        display_name:values.display_name.trim(),
        username:values.username.trim().toLowerCase(),
        password:values.password,
      };
      await authApi('request_registration', {
        email:pendingRegistration.email,
        display_name:pendingRegistration.display_name,
        username:pendingRegistration.username,
        website:values.website || '',
      });
      document.querySelector('[data-register-email]').textContent = pendingRegistration.email;
      showPanel('register-code');
      showToast('Verification code sent.', 'success');
    }
    if (action === 'register-code') {
      if (!pendingRegistration) throw new Error('Your registration session expired. Start again.');
      await authApi('verify_registration', {...pendingRegistration,code:values.code,website:values.website || ''});
      await signIn(pendingRegistration.email, pendingRegistration.password);
      pendingRegistration = null;
      redirectAfterAuth();
    }
    if (action === 'forgot-request') {
      resetEmail = values.email.trim().toLowerCase();
      const result = await authApi('request_password_reset', {email:resetEmail,website:values.website || ''});
      document.querySelector('[data-reset-email]').textContent = resetEmail;
      showPanel('forgot-code');
      showToast(result.message, 'success', 7000);
    }
    if (action === 'forgot-code') {
      if (!resetEmail) throw new Error('Your reset session expired. Request another code.');
      const result = await authApi('verify_password_reset', {email:resetEmail,code:values.code,website:values.website || ''});
      resetTicket = result.ticket;
      showPanel('forgot-password');
    }
    if (action === 'forgot-password') {
      if (values.password !== values.password_confirm) throw new Error('The passwords do not match.');
      if (!resetEmail || !resetTicket) throw new Error('Your reset session expired. Request another code.');
      await authApi('complete_password_reset', {email:resetEmail,ticket:resetTicket,password:values.password,website:values.website || ''});
      await signIn(resetEmail, values.password);
      resetTicket = '';
      redirectAfterAuth();
    }
  } catch (error) {
    fail(error.message);
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
  }
}

document.querySelectorAll('[data-auth-action]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitForm(form, form.dataset.authAction);
  });
});

document.querySelectorAll('[data-show-panel]').forEach(button => {
  button.addEventListener('click', () => showPanel(button.dataset.showPanel));
});

document.querySelectorAll('[data-resend-registration]').forEach(button => {
  button.addEventListener('click', async () => {
    if (!pendingRegistration) return fail('Your registration session expired. Start again.');
    button.disabled = true;
    try {
      await authApi('request_registration', {
        email:pendingRegistration.email,
        display_name:pendingRegistration.display_name,
        username:pendingRegistration.username,
      });
      showToast('A new verification code was sent.', 'success');
    } catch (error) { fail(error.message); }
    finally { button.disabled = false; }
  });
});

document.querySelectorAll('[data-resend-reset]').forEach(button => {
  button.addEventListener('click', async () => {
    if (!resetEmail) return fail('Enter your email again.');
    button.disabled = true;
    try {
      await authApi('request_password_reset', {email:resetEmail});
      showToast('If the account exists, a new code was sent.', 'success');
    } catch (error) { fail(error.message); }
    finally { button.disabled = false; }
  });
});

document.querySelectorAll('[data-code-input]').forEach(input => {
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g,'').slice(0,6); });
});

const { data: { user } } = supabase ? await supabase.auth.getUser() : {data:{user:null}};
if (user) location.replace('/profile/');
else showPanel(mode === 'register' ? 'register' : 'login');
