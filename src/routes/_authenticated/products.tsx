import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package as PackageIcon,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: () => (
    <AppShell requireOwner>
      <ProductsPage />
    </AppShell>
  ),
});

type Product = {
  id: string;
  shop_id: string;
  name: string;
  sku: string | null;
  buying_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  image_url: string | null;
  expiry_date: string | null;
  is_active: boolean;
};

function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Imefutwa");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (showLowOnly && p.current_stock > p.minimum_stock) return false;
    return true;
  });

  // Stats
  const totalProducts = products.length;
  const lowStockCount = products.filter((p) => p.current_stock <= p.minimum_stock).length;
  const totalInventoryValue = products.reduce((sum, p) => sum + p.buying_price * p.current_stock, 0);
  const avgSellingPrice = totalProducts > 0
    ? products.reduce((sum, p) => sum + p.selling_price, 0) / totalProducts
    : 0;

  const clearSearch = () => setQ("");

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        action={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <ProductDialog onDone={() => setCreating(false)} />
          </Dialog>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Products"
          value={String(totalProducts)}
          icon={ShoppingBag}
          variant="dark"
        />
        <StatCard
          label="Low Stock Items"
          value={String(lowStockCount)}
          sub={lowStockCount > 0 ? "Needs attention" : "All good"}
          icon={AlertTriangle}
          variant={lowStockCount > 0 ? "rose" : "mint"}
        />
        <StatCard
          label="Inventory Value"
          value={formatMoney(totalInventoryValue)}
          icon={PackageIcon}
          variant="amber"
        />
        <StatCard
          label="Avg Selling Price"
          value={formatMoney(avgSellingPrice)}
          icon={TrendingUp}
          variant="mint"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products..."
            className="pl-11 h-11 rounded-xl border-border/80 bg-card shadow-sm focus-visible:ring-blue-500"
          />
          {q && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={showLowOnly ? "default" : "outline"}
          onClick={() => setShowLowOnly((v) => !v)}
          className="rounded-xl h-11"
        >
          {showLowOnly ? "All Products" : "Low Stock Only"}
        </Button>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PackageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const lowStock = p.current_stock <= p.minimum_stock;
            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex flex-col h-full">
                  {/* Image */}
                  <div className="relative">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-32 object-cover rounded-xl bg-muted"
                      />
                    ) : (
                      <div className="w-full h-32 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-300 dark:text-blue-400 text-sm font-medium">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {lowStock && (
                      <span className="absolute top-2 right-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        Low Stock
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="mt-3 flex-1">
                    <h3 className="font-medium text-sm leading-snug line-clamp-2">{p.name}</h3>
                    {p.sku && (
                      <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <div className="text-sm font-semibold tabular-nums">
                          {formatMoney(p.selling_price)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Cost: {formatMoney(p.buying_price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-medium tabular-nums ${
                            lowStock ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {p.current_stock}
                        </div>
                        <div className="text-[11px] text-muted-foreground">min {p.minimum_stock}</div>
                      </div>
                    </div>
                    {p.expiry_date && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Expires: {new Date(p.expiry_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(p)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${p.name}"? This will deactivate the product.`))
                          deleteMut.mutate(p.id);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <ProductDialog product={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

// --- Helpers (StatCard, ProductThumb) ---

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

export function ProductThumb({ name, url }: { name: string; url: string | null }) {
  if (url)
    return <img src={url} alt={name} className="h-12 w-12 rounded-lg object-cover bg-muted" />;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-semibold text-sm shrink-0"
      style={{ background: `hsl(${hue} 55% 55%)` }}
    >
      {initials || "?"}
    </div>
  );
}

function ProductDialog({ product, onDone }: { product?: Product; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [buying, setBuying] = useState(String(product?.buying_price ?? ""));
  const [selling, setSelling] = useState(String(product?.selling_price ?? ""));
  const [stock, setStock] = useState(String(product?.current_stock ?? "0"));
  const [minStock, setMinStock] = useState(String(product?.minimum_stock ?? "5"));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [expiryDate, setExpiryDate] = useState(product?.expiry_date || "");
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { data: shopId, error: shopError } = await supabase.rpc("current_shop_id");
      if (shopError) throw shopError;
      if (!shopId) throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu.");

      const payload = {
        shop_id: shopId,
        name: name.trim(),
        sku: sku.trim() || null,
        buying_price: Number(buying) || 0,
        selling_price: Number(selling) || 0,
        current_stock: Number(stock) || 0,
        minimum_stock: Number(minStock) || 0,
        image_url: imageUrl || null,
        expiry_date: expiryDate || null,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-expiring"] });
      toast.success(product ? "Imesasishwa" : "Imeongezwa");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `products/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("shop-media")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("shop-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setImageUrl(signed?.signedUrl ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{product ? "Hariri bidhaa" : "Bidhaa mpya"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Jina</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>SKU (hiari)</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Bei ya kununua</Label>
            <Input inputMode="decimal" value={buying} onChange={(e) => setBuying(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bei ya kuuza</Label>
            <Input
              inputMode="decimal"
              value={selling}
              onChange={(e) => setSelling(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Stock ya sasa</Label>
            <Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Kikomo cha chini</Label>
            <Input
              inputMode="numeric"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tarehe ya Kuisha (Expiry Date)</Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Picha (hiari)</Label>
          <div className="flex items-center gap-3">
            <ProductThumb name={name || "?"} url={imageUrl || null} />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
              }}
            />
            {uploading && <span className="text-xs text-muted-foreground">Inapakia...</span>}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Ghairi
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !name || !selling}>
          Hifadhi
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
