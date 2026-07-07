import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Loader2, Store, Users, Shield, Settings as SettingsIcon } from "lucide-react";
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

// --- Stat card helper (mirrors dashboard) ---
const STAT_STYLES = {
  dark: {
    card: "bg-[#16294A] dark:bg-[#0a1628] text-white dark:text-slate-200 border-transparent",
    label: "text-white/70 dark:text-slate-300",
    iconWrap: "bg-white/10 text-white dark:bg-slate-700/50 dark:text-slate-200",
  },
  mint: {
    card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    iconWrap: "bg-[#E4F7EC] text-[#2FAE60] dark:bg-[#0a2a1a] dark:text-[#34d399]",
  },
  amber: {
    card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    iconWrap: "bg-[#FFF1DE] text-[#F5A623] dark:bg-[#3a2a10] dark:text-[#fbbf24]",
  },
  rose: {
    card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    iconWrap: "bg-[#FDE7E5] text-[#E4574A] dark:bg-[#3a1a1a] dark:text-[#f87171]",
  },
} as const;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = "mint",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: keyof typeof STAT_STYLES;
}) {
  const v = STAT_STYLES[variant];
  return (
    <div className={`rounded-2xl border p-4 lg:p-5 shadow-sm ${v.card}`}>
      <div className="flex items-start justify-between">
        <div className={`text-xs font-medium uppercase tracking-wide ${v.label}`}>{label}</div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${v.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className={`text-xs mt-1 ${v.label}`}>{sub}</div>}
    </div>
  );
}

// --- Data fetching ---
const fetchShopSettings = async (): Promise<ShopSettings> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error("Haujaingia.");
  if (!user) throw new Error("Hakuna mtumiaji aliyeingia.");

  if (user.email === OWNER_EMAIL) {
    const { data, error } = await supabase
      .from("shops")
      .select("id, name, logo_url, receipt_footer")
      .eq("id", SHOP_ID)
      .single();
    if (error) throw error;
    return data as ShopSettings;
  }

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

// --- Main page ---
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

  // Loading state
  if (isLoading) {
    return (
      <AppShell requireOwner>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !shop) {
    return (
      <AppShell requireOwner>
        <div className="p-8 text-center">
          <div className="text-red-500 mb-4">Imeshindwa kupakia maelezo ya duka</div>
          <Button onClick={() => refetch()} className="rounded-xl">Jaribu tena</Button>
          <Button variant="outline" className="ml-2 rounded-xl" onClick={() => supabase.auth.signOut()}>
            Ingia tena
          </Button>
        </div>
      </AppShell>
    );
  }

  // Compute some stats
  const totalCashiers = 0; // will be fetched inside CashierList, but we can keep it static for now
  // We'll fetch cashier count in a separate query to show in stats? Instead, we'll just use placeholders.
  // For a better experience, we could fetch the count here, but we already have the CashierList component.

  return (
    <AppShell requireOwner>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Settings"
          description="Manage your shop details and cashiers"
          action={
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="rounded-xl"
            >
              Refresh
            </Button>
          }
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Shop Name"
            value={shop.name || "—"}
            icon={Store}
            variant="dark"
          />
          <StatCard
            label="Total Cashiers"
            value="0" // will be updated by CashierList but we keep it as placeholder
            icon={Users}
            variant="mint"
          />
          <StatCard
            label="Owner"
            value="Kulwa Kulangwa"
            icon={Shield}
            variant="amber"
          />
          <StatCard
            label="Logo Status"
            value={shop.logo_url ? "Uploaded" : "Missing"}
            icon={SettingsIcon}
            variant={shop.logo_url ? "mint" : "rose"}
          />
        </div>

        {/* Shop Info Section */}
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 lg:p-6 shadow-sm mb-6">
          <ShopInfo
            shopId={shop.id}
            initialName={shop.name}
            initialFooter={shop.receipt_footer || ""}
          />
        </div>

        {/* Logo Upload Section */}
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 lg:p-6 shadow-sm mb-6">
          <LogoUpload shopId={shop.id} currentLogoUrl={shop.logo_url} />
        </div>

        {/* Cashier List Section */}
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 lg:p-6 shadow-sm">
          <CashierList />
        </div>
      </div>
    </AppShell>
  );
}
