beforeLoad: async () => {
  console.log('>> _authenticated/index.tsx beforeLoad');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session:', session);
    if (!session) {
      console.log('No session, redirect to /auth');
      throw redirect({ to: "/auth" });
    }
    const { data: staff, error } = await supabase
      .from("staff")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    console.log('Staff:', staff, 'Error:', error);
    if (error || !staff) {
      console.log('No staff or error, redirect to /pos');
      throw redirect({ to: "/pos" });
    }
    if (staff.role === "owner") {
      console.log('Owner, redirect to /dashboard');
      throw redirect({ to: "/dashboard" });
    } else {
      console.log('Cashier, redirect to /pos');
      throw redirect({ to: "/pos" });
    }
  } catch (err) {
    console.log('Error in beforeLoad, redirect to /auth:', err);
    throw redirect({ to: "/auth" });
  }
},
