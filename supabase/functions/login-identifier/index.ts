import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://hub.thesecretary.xyz',
  'https://the-secretary-status.github.io',
  'https://thesecretary-hub.github.io',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://hub.thesecretary.xyz',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) throw new Error('Email/username and password are required.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const publishable = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    let email = String(identifier).trim().toLowerCase();
    if (!email.includes('@')) {
      const { data, error } = await admin.rpc('resolve_login_email', { login_username: email });
      if (error || !data) throw new Error('The email, username, or password is incorrect.');
      email = data;
    }
    const client = createClient(url, publishable, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error('The email, username, or password is incorrect.');
    return Response.json({ session: data.session, user: data.user }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || 'Login failed.' }, { status: 400, headers: cors });
  }
});
