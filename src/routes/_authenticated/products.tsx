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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Package as PackageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: () => <AppShell requireOwner><ProductsPage /></AppShell>,
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
  is_active: boolean;
};

function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: products, isLoading } = useQuery({
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Imefutwa"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = (products ?? []).filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (showLowOnly && p.current_stock > p.minimum_stock) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Bidhaa"
        description="Ongeza, hariri au ondoa bidhaa dukani."
        action={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Bidhaa mpya</Button>
            </DialogTrigger>
            <ProductDialog onDone={() => setCreating(false)} />
          </Dialog>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tafuta bidhaa..." className="pl-9" />
        </div>
        <Button variant={showLowOnly ? "default" : "outline"} onClick={() => setShowLowOnly((v) => !v)}>
          Zinaisha
        </Button>
      </div>

      <div className="card-elev overflow-hidden">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Inapakia...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center">
            <PackageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Hakuna bidhaa. Ongeza ya kwanza.</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4">
                <ProductThumb name={p.name} url={p.image_url} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(p.selling_price)} · gharama {formatMoney(p.buying_price)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${p.current_stock <= p.minimum_stock ? "text-destructive" : ""}`}>{p.current_stock}</div>
                  <div className="text-xs text-muted-foreground">min {p.minimum_stock}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Futa "${p.name}"? Risiti za zamani hazitaathiriwa.`)) deleteMut.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <ProductDialog product={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

export function ProductThumb({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="h-12 w-12 rounded-lg object-cover bg-muted" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-semibold text-sm shrink-0"
         style={{ background: `hsl(${hue} 55% 55%)` }}>
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
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      // Get shop_id using the RPC function – secure and always returns the current shop
      const { data: shopId, error: shopError } = await supabase.rpc('current_shop_id');
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
      };

      if (product) {
        // Editing – keep shop_id unchanged
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        // Insert – shop_id already included
        const { error } = await supabase
          .from("products")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success(product ? "Imesasishwa" : "Imeongezwa");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `products/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("shop-media").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("shop-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setImageUrl(signed?.signedUrl ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setUploading(false); }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{product ? "Hariri bidhaa" : "Bidhaa mpya"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2"><Label>Jina</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>SKU (hiari)</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Bei ya kununua</Label><Input inputMode="decimal" value={buying} onChange={(e) => setBuying(e.target.value)} /></div>
          <div className="space-y-2"><Label>Bei ya kuuza</Label><Input inputMode="decimal" value={selling} onChange={(e) => setSelling(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Stock ya sasa</Label><Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} /></div>
          <div className="space-y-2"><Label>Kikomo cha chini</Label><Input inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <Label>Picha (hiari)</Label>
          <div className="flex items-center gap-3">
            <ProductThumb name={name || "?"} url={imageUrl || null} />
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
            {uploading && <span className="text-xs text-muted-foreground">Inapakia...</span>}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Ghairi</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !name || !selling}>Hifadhi</Button>
      </DialogFooter>
    </DialogContent>
  );
}
