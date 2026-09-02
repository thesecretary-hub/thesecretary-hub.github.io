import { requireSupabase, supabase } from './supabase-client.js';
import { esc, mountLayout, showToast } from './layout.js';

await mountLayout('');
const form = document.querySelector('[data-auth-form]');
const errorBox = document.querySelector('[data-auth-error]');
const mode = document.body.dataset.auth;

function fail(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  const values = Object.fromEntries(new FormData(form));
  try {
    const client = requireSupabase();
    if (mode === 'register') {
      if (values.password !== values.password_confirm) throw new Error('The passwords do not match.');
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(values.username)) throw new Error('Username must use 3–32 letters, numbers, or underscores.');
      const { data, error } = await client.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: { data: { display_name: values.display_name.trim(), username: values.username.trim().toLowerCase() } },
      });
      if (error) throw error;
      if (!data.session) {
        showToast('Account created. Check your email to confirm it.', 'success', 9000);
        form.reset();
        return;
      }
    } else {
      const identifier = values.identifier.trim().toLowerCase();
      if (identifier.includes('@')) {
        const { error } = await client.auth.signInWithPassword({ email: identifier, password: values.password });
        if (error) throw error;
      } else {
        const { data, error } = await client.functions.invoke('login-identifier', { body: { identifier, password: values.password } });
        if (error || data?.error || !data?.session) throw new Error(data?.error || 'Login failed. Deploy the login-identifier Edge Function first.');
        const { error: sessionError } = await client.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        if (sessionError) throw sessionError;
      }
    }
    const returnTo = new URLSearchParams(location.search).get('return');
    location.href = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  } catch (error) { fail(error.message); }
  finally { button.disabled = false; }
});

const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
if (user) document.querySelector('[data-already-signed-in]')?.removeAttribute('hidden');
