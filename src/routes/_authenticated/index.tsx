import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { AlertTriangle, TrendingUp, Package, Users, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  component: () => <AppShell requireOwner><DashboardPage /></AppShell>,
});

function DashboardPage() {
  const today = new Date();
  const from = new Date(today); from.setDate(today.getDate() - 30);

  const { data: summary } = useQuery({
    queryKey: ["report-summary", from.toISOString().slice(0, 10), today.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_sales_summary", {
        _from: from.toISOString().slice(0, 10),
        _to: today.toISOString().slice(0, 10),
      });
      if (error) throw error;
      return data as Array<{ day: string; sales_count: number; revenue: number; cost: number; profit: number; discount_total: number }>;
    },
  });

  const { data: debtors } = useQuery({
    queryKey: ["dashboard-debtors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_customer_balances")
        .select("customer_id, name, phone, balance, last_purchase_at")
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Array<{ customer_id: string; name: string; phone: string | null; balance: number; last_purchase_at: string | null }>;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_low_stock").select("id, name, current_stock, minimum_stock").limit(6);
      if (error) throw error;
      return data as Array<{ id: string; name: string; current_stock: number; minimum_stock: number }>;
    },
  });

  const { data: bestSellers } = useQuery({
    queryKey: ["dashboard-best-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_best_sellers").select("product_id, product_name, units_sold, revenue").order("revenue", { ascending: false }).limit(5);
      if (error) throw error;
      return data as Array<{ product_id: string; product_name: string; units_sold: number; revenue: number }>;
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ["dashboard-recent-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("id, receipt_number, total, sale_type, payment_method, created_at").order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data as Array<{ id: string; receipt_number: string; total: number; sale_type: string; payment_method: string | null; created_at: string }>;
    },
  });

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const isSameDay = (s: string) => s === todayKey;
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const inRange = (d: string, start: Date) => new Date(d) >= start;

  const rows = summary ?? [];
  const totals = {
    todayRev: rows.filter((r) => isSameDay(r.day)).reduce((s, r) => s + Number(r.revenue), 0),
    todayProfit: rows.filter((r) => isSameDay(r.day)).reduce((s, r) => s + Number(r.profit), 0),
    weekRev: rows.filter((r) => inRange(r.day, startOfWeek)).reduce((s, r) => s + Number(r.revenue), 0),
    monthRev: rows.filter((r) => inRange(r.day, startOfMonth)).reduce((s, r) => s + Number(r.revenue), 0),
    monthProfit: rows.filter((r) => inRange(r.day, startOfMonth)).reduce((s, r) => s + Number(r.profit), 0),
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description="Muhtasari wa duka lako" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <StatCard label="Mauzo Leo" value={formatMoney(totals.todayRev)} sub={`Faida ${formatMoney(totals.todayProfit)}`} accent />
        <StatCard label="Wiki hii" value={formatMoney(totals.weekRev)} sub="Mauzo" />
        <StatCard label="Mwezi huu" value={formatMoney(totals.monthRev)} sub={`Faida ${formatMoney(totals.monthProfit)}`} />
        <StatCard label="Deni jumla" value={formatMoney((debtors ?? []).reduce((s, d) => s + Number(d.balance), 0))} sub={`${debtors?.length ?? 0} wateja`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader icon={Users} title="Wateja wenye deni" href="/customers" />
          <div className="divide-y divide-border">
            {(debtors ?? []).length === 0 && <EmptyRow msg="Hakuna deni kwa sasa." />}
            {(debtors ?? []).map((d) => (
              <Link key={d.customer_id} to="/customers/$id" params={{ id: d.customer_id }} className="flex items-center justify-between py-3 hover:bg-accent/40 -mx-4 px-4">
                <div>
                  <div className="font-medium text-sm">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.phone ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-destructive">{formatMoney(d.balance)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={AlertTriangle} title="Bidhaa zinaisha" href="/inventory" />
          <div className="divide-y divide-border">
            {(lowStock ?? []).length === 0 && <EmptyRow msg="Vyote viko sawa." />}
            {(lowStock ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs">
                  <span className={p.current_stock === 0 ? "text-destructive font-semibold" : "text-warning-foreground"}>
                    {p.current_stock}
                  </span>
                  <span className="text-muted-foreground"> / min {p.minimum_stock}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={TrendingUp} title="Bidhaa zinauzwa zaidi" href="/reports" />
          <div className="divide-y divide-border">
            {(bestSellers ?? []).length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
            {(bestSellers ?? []).map((b) => (
              <div key={b.product_id} className="flex items-center justify-between py-3">
                <div className="text-sm font-medium truncate">{b.product_name}</div>
                <div className="text-xs text-muted-foreground">{b.units_sold} u · {formatMoney(b.revenue)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Receipt} title="Mauzo ya hivi karibuni" href="/sales" />
          <div className="divide-y divide-border">
            {(recentSales ?? []).length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
            {(recentSales ?? []).map((s) => (
              <Link key={s.id} to="/sales/$id" params={{ id: s.id }} className="flex items-center justify-between py-3 hover:bg-accent/40 -mx-4 px-4">
                <div>
                  <div className="text-sm font-medium">#{s.receipt_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} · {s.sale_type === "credit" ? "Deni" : s.payment_method === "lipa_namba" ? "Lipa Namba" : "Cash"}</div>
                </div>
                <div className="font-semibold">{formatMoney(s.total)}</div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card-elev p-4 lg:p-5 ${accent ? "bg-primary text-primary-foreground border-transparent" : ""}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
      <div className="stat-number mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-elev p-4 lg:p-5 ${className}`}>{children}</div>;
}

function CardHeader({ icon: Icon, title, href }: { icon: React.ComponentType<{ className?: string }>; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {href && <Link to={href} className="text-xs text-primary hover:underline">Ona vyote →</Link>}
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{msg}</div>;
}
