beforeLoad: async () => {
  console.log("🔐 _authenticated/index beforeLoad");

  let session = null;
  let retries = 0;
  while (!session && retries < 5) {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    if (!session) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }
  }

  if (!session) {
    console.warn("⚠️ No session after retries, redirecting to /auth");
    throw redirect({ to: "/auth", replace: true });
  }

  const { data: staff, error } = await supabase
    .from("staff")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !staff) {
    console.warn("⚠️ No staff record, redirecting to /pos");
    throw redirect({ to: "/pos", replace: true });
  }

  if (staff.role === "owner") {
    throw redirect({ to: "/dashboard", replace: true });
  } else {
    throw redirect({ to: "/pos", replace: true });
  }
},
