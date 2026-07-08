import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
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

// ----- Mock data (static) -----
const MOCK_DEBTORS = [
  { customer_id: "1", name: "John Doe", phone: "0712345678", balance: 45000 },
  { customer_id: "2", name: "Jane Smith", phone: "0712345679", balance: 23000 },
];
const MOCK_LOW_STOCK = [
  { id: "1", name: "Sugar", current_stock: 2, minimum_stock: 10 },
  { id: "2", name: "Cooking Oil", current_stock: 5, minimum_stock: 8 },
];
const MOCK_BEST_SELLERS = [
  { product_id: "1", product_name: "Maize Flour", units_sold: 45, revenue: 67500 },
  { product_id: "2", product_name: "Rice", units_sold: 30, revenue: 45000 },
];
const MOCK_RECENT_SALES = [
  { id: "1", receipt_number: "REC-123", total: 15000, sale_type: "cash", payment_method: "cash", created_at: new Date().toISOString() },
  { id: "2", receipt_number: "REC-124", total: 25000, sale_type: "credit", payment_method: "credit", created_at: new Date().toISOString() },
];

const MOCK_TOTALS = {
  todayRev: 15000,
  todayProfit: 3000,
  weekRev: 85000,
  monthRev: 320000,
  monthProfit: 64000,
};
const MOCK_DEBT_TOTAL = 68000;

function DashboardPage() {
  // No real queries – all data is mocked
  const debtors = MOCK_DEBTORS;
  const lowStock = MOCK_LOW_STOCK;
  const bestSellers = MOCK_BEST_SELLERS;
  const recentSales = MOCK_RECENT_SALES;
  const totals = MOCK_TOTALS;
  const totalDebt = MOCK_DEBT_TOTAL;

  return (
    <AppShell requireOwner>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Dashboard" description="Muhtasari wa duka lako" />

        {/* Stat row */}
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
            sub={`${debtors.length} wateja wenye deni`}
            icon={Users}
            variant="rose"
          />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader icon={Users} iconBg="bg-[#EFE7FF] text-[#7C5CFC] dark:bg-[#2a1a4a] dark:text-[#a88cff]" title="Wateja wenye deni" href="/customers" />
            <div className="divide-y divide-border/60 dark:divide-border/20">
              {debtors.length === 0 && <EmptyRow msg="Hakuna deni kwa sasa." />}
              {debtors.map((d) => (
                <Link
                  key={d.customer_id}
                  to="/customers/$id"
                  params={{ id: d.customer_id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/40 rounded-xl -mx-2 px-2 transition-colors dark:hover:bg-accent/20"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name} />
                    <div>
                      <div className="font-medium text-sm dark:text-foreground">{d.name}</div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground/80">{d.phone}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[#E4574A] dark:text-[#f87171]">{formatMoney(d.balance)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader icon={AlertTriangle} iconBg="bg-[#FFF1DE] text-[#F5A623] dark:bg-[#3a2a10] dark:text-[#fbbf24]" title="Bidhaa zinaisha" href="/inventory" />
            <div className="divide-y divide-border/60 dark:divide-border/20">
              {lowStock.length === 0 && <EmptyRow msg="Vyote viko sawa." />}
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="text-sm font-medium dark:text-foreground">{p.name}</div>
                  <div className="text-xs">
                    <span className="text-[#F5A623] dark:text-[#fbbf24] font-semibold">
                      {p.current_stock}
                    </span>
                    <span className="text-muted-foreground dark:text-muted-foreground/70"> / min {p.minimum_stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader icon={TrendingUp} iconBg="bg-[#E4F7EC] text-[#2FAE60] dark:bg-[#0a2a1a] dark:text-[#34d399]" title="Bidhaa zinauzwa zaidi" href="/reports" />
            <div className="divide-y divide-border/60 dark:divide-border/20">
              {bestSellers.length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
              {bestSellers.map((b, i) => (
                <div key={b.product_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16294A] dark:bg-[#2a4a7a] text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="text-sm font-medium truncate dark:text-foreground">{b.product_name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-muted-foreground/70 shrink-0 pl-2">{b.units_sold} u · {formatMoney(b.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader icon={Package} iconBg="bg-[#DCEBFF] text-[#2E6BE6] dark:bg-[#0a1a3a] dark:text-[#60a5fa]" title="Mauzo ya hivi karibuni" href="/sales" />
            <div className="divide-y divide-border/60 dark:divide-border/20">
              {recentSales.length === 0 && <EmptyRow msg="Bado hakuna mauzo." />}
              {recentSales.map((s) => (
                <Link
                  key={s.id}
                  to="/sales/$id"
                  params={{ id: s.id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/40 rounded-xl -mx-2 px-2 transition-colors dark:hover:bg-accent/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F6F9] dark:bg-[#1a2a3a]">
                      <Receipt className="h-4 w-4 text-[#16294A] dark:text-[#60a5fa]" />
                    </span>
                    <div>
                      <div className="text-sm font-medium dark:text-foreground">#{s.receipt_number}</div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground/80">
                        {new Date(s.created_at).toLocaleString()} · {s.sale_type === "credit" ? "Deni" : "Cash"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-semibold dark:text-foreground">
                    {formatMoney(s.total)}
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground/70" />
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

// ----- Helpers (same as before) -----

const VARIANT_STYLES = {
  dark: {
    card: "bg-[#16294A] text-white dark:bg-[#0a1628] dark:text-slate-200 border-transparent",
    label: "text-white/70 dark:text-slate-300",
    sub: "text-white/70 dark:text-slate-300",
    iconWrap: "bg-white/10 text-white dark:bg-slate-700/50 dark:text-slate-200",
  },
  mint: {
    card: "bg-white border-border dark:bg-[#1a2a2a] dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    sub: "text-muted-foreground dark:text-muted-foreground/80",
    iconWrap: "bg-[#E4F7EC] text-[#2FAE60] dark:bg-[#0a2a1a] dark:text-[#34d399]",
  },
  amber: {
    card: "bg-white border-border dark:bg-[#2a1a0a] dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    sub: "text-muted-foreground dark:text-muted-foreground/80",
    iconWrap: "bg-[#FFF1DE] text-[#F5A623] dark:bg-[#3a2a10] dark:text-[#fbbf24]",
  },
  rose: {
    card: "bg-white border-border dark:bg-[#2a1010] dark:border-border/30",
    label: "text-muted-foreground dark:text-muted-foreground/80",
    sub: "text-muted-foreground dark:text-muted-foreground/80",
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
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16294A]/10 dark:bg-[#2a4a7a]/30 text-[11px] font-semibold text-[#16294A] dark:text-slate-200">
      {initials || "?"}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 lg:p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
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
        <h3 className="font-semibold text-sm dark:text-foreground">{title}</h3>
      </div>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-xs font-medium text-[#2E6BE6] dark:text-[#60a5fa] hover:underline">
          Ona vyote <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground dark:text-muted-foreground/70">{msg}</div>;
}
