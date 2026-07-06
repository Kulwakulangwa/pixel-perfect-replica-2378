import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  Users,
  DollarSign,
  Truck,
  BarChart,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["owner"] },
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { to: "/today", label: "Today", icon: Calendar, roles: ["owner", "cashier"] },
  { to: "/customers", label: "Wateja", icon: Users, roles: ["owner", "cashier"] },
  { to: "/expenses", label: "Gharama", icon: DollarSign, roles: ["owner"] },
  { to: "/suppliers", label: "Wauzaji", icon: Truck, roles: ["owner"] },
  { to: "/reports", label: "Ripoti", icon: BarChart, roles: ["owner"] },
  { to: "/products", label: "Bidhaa", icon: Package, roles: ["owner"] },
  { to: "/settings", label: "Mipangilio", icon: Settings, roles: ["owner"] },
];

type AppShellProps = {
  children: React.ReactNode;
  requireOwner?: boolean;
};

export function AppShell({ children, requireOwner = false }: AppShellProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<"owner" | "cashier">("cashier");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate({ to: "/auth" });
          return;
        }

        const { data: staff, error } = await supabase
          .from("staff")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.warn("Staff fetch error, defaulting to cashier:", error);
          if (isMounted) setUserRole("cashier");
        } else if (staff) {
          if (isMounted) setUserRole(staff.role as "owner" | "cashier");
        } else {
          if (isMounted) setUserRole("cashier");
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        if (isMounted) setUserRole("cashier");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Force a timeout to avoid infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Role fetch timed out, defaulting to cashier");
        setUserRole("cashier");
        setLoading(false);
      }
    }, 3000);

    fetchUserRole();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  // Owner-only redirect
  useEffect(() => {
    if (!loading && userRole === "cashier" && requireOwner) {
      navigate({ to: "/pos" });
    }
  }, [loading, userRole, requireOwner, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  // Always render something after loading – no hydration mismatch
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(userRole as any)
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 lg:relative lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Wakuja Shop</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-3 py-4">
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = router.state.location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-3 right-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Toka
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {userRole === "owner" ? "Meneja" : "Cashier"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="lg:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// PageHeader component (exported)
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
