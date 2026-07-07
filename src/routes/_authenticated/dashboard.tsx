import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import {
  AlertTriangle,
  TrendingUp,
  Package,
  Users,
  Receipt,
  Wallet,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: DashboardPage,
});

function DashboardPage() {
  const [now] = useState(() => new Date());
  const [todayStr, setTodayStr] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [startOfWeek, setStartOfWeek] = useState<Date>(new Date());
  const [startOfMonth, setStartOfMonth] = useState<Date>(new Date());

  useEffect(() => {
    setTodayStr(now.toISOString().slice(0, 10));
    const sw = new Date(now);
    sw.setDate(now.getDate() - now.getDay());
    setStartOfWeek(sw);
    const sm = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartOfMonth(sm);
    const f = new Date(now);
    f.setDate(now.getDate() - 30);
    setFromDate(f.toISOString().slice(0, 10));
    setToDate(now.toISOString().slice(0, 10));
  }, [now]);

  const { data: summary } = useQuery({
    queryKey: ["report-summary", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_sales_summary", {
        _from: fromDate,
        _to: toDate,
      });
      if (error) throw error;
      return data as Array<{ day: string; sales_count: number; revenue: number; cost: number; profit: number; discount_total: number }>;
    },
    enabled: !!fromDate && !!toDate,
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

  const isSameDay = (s: string) => s === todayStr;
  const inRange = (d: string, start: Date) => new Date(d) >= start;

  const rows = summary ?? [];
  const totals = {
    todayRev: rows.filter((r) => isSameDay(r.day)).reduce((s, r) => s + Number(r.revenue), 0),
    todayProfit: rows.filter((r) => isSameDay(r.day)).reduce((s, r) => s + Number(r.profit), 0),
    weekRev: rows.filter((r) => inRange(r.day, startOfWeek)).reduce((s, r) => s + Number(r.revenue), 0),
    monthRev: rows.filter((r) => inRange(r.day, startOfMonth)).reduce((s, r) => s + Number(r.revenue), 0),
    monthProfit: rows.filter((r) => inRange(r.day, startOfMonth)).reduce((s, r) => s + Number(r.profit), 0),
  };

  const totalDebt = (debtors ?? []).reduce((s, d) => s + Number(d.balance), 0);

  return (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Dashboard" description="Muhtasari wa duka lako" />

        {/* Stat row — dark navy hero card + three light cards, icon badges like the reference */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <StatCard
            label="Mauzo Leo"
            value={formatMoney(totals.todayRev)}
            sub={`Faida ${formatMoney(totals.todayProfit)}`}
            icon={Wallet}
            variant="dark"
          />
          <StatCard
            label="Wiki hii"
            value={formatMoney(totals.weekRev)}
            sub="Mauzo ya wiki"
            icon={TrendingUp}
            variant="mint"
          />
          <StatCard
            label="Mwezi huu"
            value={formatMoney(totals.monthRev)}
            sub={`Faida ${formatMoney(totals.monthProfit)}`}
            icon={Receipt}
            variant="amber"
          />
          <StatCard
            label="Deni jumla"
            value={formatMoney(totalDebt)}
            sub={`${debtors?.length ?? 0} wateja wenye deni`}
            icon={Users}
            variant="rose"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader icon={Users} iconBg="bg-[#EFE7FF] text-[#7C5CFC]" title="Wateja wenye deni" href="/customers" />
            <div className="divide-y divide-border/60">
              {(debtors ?? []).length === 0 && <EmptyRow msg="Hakuna deni kwa sasa." />}
              {(debtors ?? []).map((d) => (
                <Link
                  key={d.customer_id}
                  to="/customers/$id"
                  params={{ id: d.customer_id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/40 rounded-xl -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name} />
                    <div>
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.phone ?? "—"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[#E4574A]">{formatMoney(d.balance)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader icon={AlertTriangle} iconBg="bg-[#FFF1DE] text-[#F5A623]" title="Bidhaa zinaisha" href="/inventory" />
            <div className="divide-y divide-border/60">
              {(lowStock ?? []).length === 0 && <EmptyRow msg="Vyote viko sawa." />}
              {(lowStock ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs">
                    <span className={p.current_stock === 0 ? "text-[#E4574A] font-semibold" : "text-[#F5A623] font-semibold"}>
                      {p.current_stock}
                    </span>
                    <span className="text-muted-foreground"> / min {p.minimum_stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader icon={TrendingUp} iconBg="bg-[#E4F7EC] text-[#2FAE60]" title="Bidhaa zinauzwa zaidi" href="/reports" />
            <div className="divide-y divide-border/60">
              {(bestSellers ?? []).length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
              {(bestSellers ?? []).map((b, i) => (
                <div key={b.product_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16294A] text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="text-sm font-medium truncate">{b.product_name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 pl-2">{b.units_sold} u · {formatMoney(b.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader icon={Package} iconBg="bg-[#DCEBFF] text-[#2E6BE6]" title="Mauzo ya hivi karibuni" href="/sales" />
            <div className="divide-y divide-border/60">
              {(recentSales ?? []).length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
              {(recentSales ?? []).map((s) => (
                <Link
                  key={s.id}
                  to="/sales/$id"
                  params={{ id: s.id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/40 rounded-xl -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F6F9]">
                      <Receipt className="h-4 w-4 text-[#16294A]" />
                    </span>
                    <div>
                      <div className="text-sm font-medium">#{s.receipt_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()} · {s.sale_type === "credit" ? "Deni" : s.payment_method === "lipa_namba" ? "Lipa Namba" : "Cash"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-semibold">
                    {formatMoney(s.total)}
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ----- Helpers -----

const VARIANT_STYLES = {
  dark: {
    card: "bg-[#16294A] text-white border-transparent",
    label: "text-white/70",
    sub: "text-white/70",
    iconWrap: "bg-white/10 text-white",
  },
  mint: {
    card: "bg-white border-border",
    label: "text-muted-foreground",
    sub: "text-muted-foreground",
    iconWrap: "bg-[#E4F7EC] text-[#2FAE60]",
  },
  amber: {
    card: "bg-white border-border",
    label: "text-muted-foreground",
    sub: "text-muted-foreground",
    iconWrap: "bg-[#FFF1DE] text-[#F5A623]",
  },
  rose: {
    card: "bg-white border-border",
    label: "text-muted-foreground",
    sub: "text-muted-foreground",
    iconWrap: "bg-[#FDE7E5] text-[#E4574A]",
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
  variant?: keyof typeof VARIANT_STYLES;
}) {
  const v = VARIANT_STYLES[variant];
  return (
    <div className={`rounded-2xl border p-4 lg:p-5 shadow-sm ${v.card}`}>
      <div className="flex items-start justify-between">
        <div className={`text-xs font-medium uppercase tracking-wide ${v.label}`}>{label}</div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${v.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className={`text-xs mt-1 ${v.sub}`}>{sub}</div>}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16294A]/10 text-[11px] font-semibold text-[#16294A]">
      {initials || "?"}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-white p-4 lg:p-5 shadow-sm ${className}`}>{children}</div>;
}

function CardHeader({
  icon: Icon,
  iconBg,
  title,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-xs font-medium text-[#2E6BE6] hover:underline">
          Ona vyote <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{msg}</div>;
}
