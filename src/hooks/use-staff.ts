import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type StaffProfile = {
  id: string;
  shop_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "owner" | "cashier";
  can_discount: boolean;
  can_manage_till: boolean;
  is_active: boolean;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? (null as User | null), loading };
}

export function useStaff() {
  const { session, loading: sessionLoading } = useSession();
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.user) {
      setStaff(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("staff")
      .select(
        "id, shop_id, full_name, email, phone, role, can_discount, can_manage_till, is_active",
      )
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) setError(error.message);
    setStaff((data as StaffProfile) ?? null);
    setLoading(false);
  }, [session?.user?.id, sessionLoading]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { staff, loading: loading || sessionLoading, error, refetch, session };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
