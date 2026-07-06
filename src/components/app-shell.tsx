import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Navigation items
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
  const [userRole, setUserRole] = useState<"owner" | "cashier" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: staff } = await supabase
        .from("staff")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(staff?.role || "cashier");
      setLoading(false);

      // If this page requires owner but user is cashier, redirect to POS
      if (requireOwner && staff?.role === "cashier") {
        navigate({ to: "/pos" });
      }
    };
    fetchUserRole();
  }, [navigate, requireOwner]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Filter nav items based on role
  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(userRole as any)
  );

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = router.state.location.pathname === item.to;
    return (
      <Link
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
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
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

        <ScrollArea className="h-[calc(100vh-4rem)] px-3 py-4">
          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
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
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
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

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
