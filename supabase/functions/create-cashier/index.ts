import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import CORS headers from the Supabase SDK (v2.95.0+)
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

Deno.serve(async (req) => {
  // Handle CORS preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, full_name } = await req.json()

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const supabaseAdmin = createClient(
      'https://ejapxqqtvuouqggdbmxx.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXB4cXF0dnVvdXFnZ2RibXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3NTEzNywiZXhwIjoyMDk4ODUxMTM3fQ.ogiIq2PFqqoUr7hRaf3BPg3ehLojnhKiIXbFk9uK1Po',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name },
      email_confirm: true,
    })

    if (error) {
      console.error('Error creating user:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    return new Response(
      JSON.stringify({ user: data.user }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
