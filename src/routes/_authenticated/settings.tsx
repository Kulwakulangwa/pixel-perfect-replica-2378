import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ShopInfo, LogoUpload, CashierList } from "@/components/settings";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

const OWNER_EMAIL = "kulwakulangwa@gmail.com";
const SHOP_ID = "11111111-1111-1111-1111-111111111111";

type ShopSettings = {
  id: string;
  name: string;
  logo_url: string | null;
  receipt_footer: string | null;
};

const fetchShopSettings = async (): Promise<ShopSettings> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error("Haujaingia.");
  if (!user) throw new Error("Hakuna mtumiaji aliyeingia.");

  // Owner gets hardcoded shop ID
  if (user.email === OWNER_EMAIL) {
    const { data, error } = await supabase
      .from("shops")
      .select("id, name, logo_url, receipt_footer")
      .eq("id", SHOP_ID)
      .single();
    if (error) throw error;
    return data as ShopSettings;
  }

  // Cashiers fallback
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("shop_id")
    .eq("id", user.id)
    .single();
  if (staffError || !staff?.shop_id) throw new Error("Hakuna duka.");
  const { data, error } = await supabase
    .from("shops")
    .select("id, name, logo_url, receipt_footer")
    .eq("id", staff.shop_id)
    .single();
  if (error) throw error;
  return data as ShopSettings;
};

function SettingsPage() {
  const {
    data: shop,
    isLoading,
    error,
    refetch,
  } = useQuery<ShopSettings, Error>({
    queryKey: ["shopSettings"],
    queryFn: fetchShopSettings,
    retry: 1,
  });

  useEffect(() => {
    if (error) {
      toast.error("Imeshindwa kupakia maelezo ya duka: " + error.message);
    }
  }, [error]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !shop) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <div className="text-red-500 mb-4">Imeshindwa kupakia maelezo ya duka</div>
          <Button onClick={() => refetch()}>Jaribu tena</Button>
          <Button variant="outline" className="ml-2" onClick={() => supabase.auth.signOut()}>
            Ingia tena
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Mipangilio" description="Dhibiti mazingira ya duka lako" />
      <div className="space-y-8">
        <ShopInfo
          shopId={shop.id}
          initialName={shop.name}
          initialFooter={shop.receipt_footer || ""}
        />
        <LogoUpload shopId={shop.id} currentLogoUrl={shop.logo_url} />
        <CashierList />
      </div>
    </AppShell>
  );
}
