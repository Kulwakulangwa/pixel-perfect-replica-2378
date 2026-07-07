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
  Sun,
  Moon,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner"] },
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { to: "/today", label: "Today", icon: Calendar, roles: ["owner", "cashier"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["owner", "cashier"] },
  { to: "/expenses", label: "Expenses", icon: DollarSign, roles: ["owner"] },
  { to: "/suppliers", label: "Suppliers", icon: Truck, roles: ["owner"] },
  { to: "/reports", label: "Reports", icon: BarChart, roles: ["owner"] },
  { to: "/products", label: "Products", icon: Package, roles: ["owner"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
];

type AppShellProps = {
  children: React.ReactNode;
  requireOwner?: boolean;
};

export function AppShell({ children, requireOwner = false }: AppShellProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<"owner" | "cashier" | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // --- Dark mode ---
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as "light" | "dark" | null;
      if (stored) return stored;
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // --- User data ---
  useEffect(() => {
    let cancelled = false;
    const fetchUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) navigate({ to: "/auth" });
          return;
        }
        // Get user email
        setUserEmail(session.user.email || "");
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User");

        const { data: staff, error } = await supabase
          .from("staff")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("Staff fetch error:", error);
          setUserRole("cashier");
        } else {
          setUserRole((staff?.role as "owner" | "cashier") ?? "cashier");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        if (!cancelled) setUserRole("cashier");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUserData();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!loading && userRole === "cashier" && requireOwner) {
      navigate({ to: "/pos" });
    }
  }, [loading, userRole, requireOwner, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || userRole === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (requireOwner && userRole !== "owner") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex min-h-screen bg-background" suppressHydrationWarning>
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300",
          "lg:translate-x-0 lg:relative",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Profile Section */}
        <div className="flex flex-col items-center px-4 py-6 border-b">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User className="h-8 w-8" />
          </div>
          <div className="mt-3 text-center">
            <p className="font-semibold text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 py-4 h-[calc(100vh-12rem)] flex flex-col">
          <nav className="space-y-1 flex-1">
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

          {/* Bottom actions */}
          <div className="pt-4 border-t space-y-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>

            {/* Logout */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Store className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Wakuja Shop</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content with max-width and centering */}
        <main className="flex-1 overflow-auto px-4 py-6 lg:px-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
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
