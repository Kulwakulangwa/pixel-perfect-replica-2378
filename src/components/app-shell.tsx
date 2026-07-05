import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, Boxes, Receipt, Users, Truck, Wallet,
  BarChart3, Settings, ShoppingCart, Clock, TrendingUp, User,
  LogOut, Store, Menu, X, WifiOff, Wallet2,
} from "lucide-react";
import { useStaff, signOut, type StaffProfile } from "@/hooks/use-staff";
import { useOnline } from "@/hooks/use-online";
import { startBackgroundSync } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; };

const OWNER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/customers", label: "Deni", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const CASHIER_NAV: NavItem[] = [
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/today", label: "Today", icon: Clock },
  { to: "/insights", label: "Insights", icon: TrendingUp },
  { to: "/till", label: "Till", icon: Wallet2 },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children, requireOwner }: { children: ReactNode; requireOwner?: boolean }) {
  const { staff, loading } = useStaff();
  const navigate = useNavigate();

  useEffect(() => {
    const stop = startBackgroundSync();
    return stop;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!staff) { void signOut(); return; }
    if (requireOwner && staff.role !== "owner") {
      navigate({ to: "/pos", replace: true });
    }
  }, [loading, staff, requireOwner, navigate]);

  if (loading || !staff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const nav = staff.role === "owner" ? OWNER_NAV : CASHIER_NAV;
  return <ShellChrome staff={staff} nav={nav}>{children}</ShellChrome>;
}

function ShellChrome({ staff, nav, children }: { staff: StaffProfile; nav: NavItem[]; children: ReactNode }) {
  const location = useLocation();
  const online = useOnline();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isCashier = staff.role === "cashier";

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  const mobileTabs = isCashier ? nav : nav.slice(0, 4);
  const overflowItems = isCashier ? [] : nav.slice(4);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-surface no-print">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Wakuja Shop</div>
              <div className="text-xs text-muted-foreground capitalize">{staff.role}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive(item.to) ? "bg-primary text-primary-foreground shadow-elev-1" : "text-foreground/80 hover:bg-accent"
              }`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent">
            <LogOut className="h-4 w-4" /> Toka
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border no-print">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Store className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm">Wakuja</span>
            </div>
            <div className="flex items-center gap-2">
              {!online && (
                <span className="text-xs flex items-center gap-1 text-warning-foreground bg-warning/20 px-2 py-1 rounded-md">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
              {!isCashier && overflowItems.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Desktop online pill */}
        {!online && (
          <div className="hidden lg:flex sticky top-0 z-20 bg-warning/15 text-warning-foreground text-xs font-medium px-4 py-1.5 items-center gap-2 no-print">
            <WifiOff className="h-3.5 w-3.5" /> Hakuna internet — mauzo yatatunzwa na kutumwa baadaye
          </div>
        )}

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border no-print">
          <div className="grid grid-cols-5">
            {mobileTabs.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  isActive(item.to) ? "text-primary" : "text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            {isCashier ? (
              <Link to="/profile" className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive("/profile") ? "text-primary" : "text-muted-foreground"
              }`}>
                <User className="h-5 w-5" />
                Profile
              </Link>
            ) : (
              <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground">
                <Menu className="h-5 w-5" />
                More
              </button>
            )}
          </div>
        </nav>

        {/* Mobile drawer for owner overflow */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 no-print">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-surface p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">Menu</span>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}><X className="h-5 w-5" /></Button>
              </div>
              <nav className="space-y-1 flex-1">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setDrawerOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      isActive(item.to) ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}>
                      <Icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
              </nav>
              <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-muted-foreground hover:bg-accent">
                <LogOut className="h-4 w-4" /> Toka
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
