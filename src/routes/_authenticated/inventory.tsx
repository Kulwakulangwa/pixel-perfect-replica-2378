import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Package as PackageIcon } from "lucide-react";
import { ProductThumb } from "./products";

export const Route = createFileRoute("/_authenticated/inventory")({
  ssr: false,
  component: () => (
    <AppShell requireOwner>
      <InventoryPage />
    </AppShell>
  ),
});

type Product = {
  id: string;
  name: string;
  current_stock: number;
  minimum_stock: number;
  image_url: string | null;
};
type Movement = {
  id: string;
  product_id: string;
  type: string;
  quantity_change: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  product_name?: string;
};

type MovementQueryRow = {
  id: string;
  product_id: string;
  type: string;
  quantity_change: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  products: { name: string } | null;
};

function InventoryPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, current_stock, minimum_stock, image_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(
          "id, product_id, type, quantity_change, note, created_at, created_by, products(name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as MovementQueryRow[]).map((m) => ({
        ...m,
        product_name: m.products?.name,
      })) as Movement[];
    },
  });

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Inventory"
        description="Ongeza stock au hariri, na uone historia."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Movement
              </Button>
            </DialogTrigger>
            <MovementDialog products={products ?? []} onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <section>
          <h2 className="text-sm font-semibold mb-2">Bidhaa & stock</h2>
          <div className="card-elev divide-y divide-border max-h-[600px] overflow-y-auto">
            {(products ?? []).length === 0 && (
              <div className="p-8 text-center">
                <PackageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Hakuna bidhaa.</p>
              </div>
            )}
            {(products ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <ProductThumb name={p.name} url={p.image_url} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">min {p.minimum_stock}</div>
                </div>
                <div
                  className={`font-semibold ${p.current_stock <= p.minimum_stock ? "text-destructive" : ""}`}
                >
                  {p.current_stock}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">Historia (50 za mwisho)</h2>
          <div className="card-elev divide-y divide-border max-h-[600px] overflow-y-auto">
            {(movements ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Bado hakuna historia.
              </div>
            )}
            {(movements ?? []).map((m) => (
              <div key={m.id} className="p-3 flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${m.quantity_change > 0 ? "bg-success" : "bg-destructive"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.product_name ?? m.product_id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.type.replace("_", " ")} · {new Date(m.created_at).toLocaleString()}
                    {m.note ? ` · ${m.note}` : ""}
                  </div>
                </div>
                <div
                  className={`font-semibold text-sm ${m.quantity_change > 0 ? "text-success" : "text-destructive"}`}
                >
                  {m.quantity_change > 0 ? "+" : ""}
                  {m.quantity_change}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MovementDialog({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"restock" | "adjustment">("restock");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const n = Number(qty);
      if (!productId || !n) throw new Error("Chagua bidhaa na weka idadi.");
      const { data: staff } = await supabase.from("staff").select("shop_id").single();
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_movements").insert({
        shop_id: staff!.shop_id,
        product_id: productId,
        type,
        quantity_change: type === "restock" ? Math.abs(n) : n,
        note: note.trim() || null,
        created_by: user.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success("Imeongezwa");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Stock movement</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Bidhaa</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Chagua bidhaa" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.current_stock})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Aina</Label>
          <Select value={type} onValueChange={(v) => setType(v as "restock" | "adjustment")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restock">Restock (ongeza)</SelectItem>
              <SelectItem value="adjustment">Adjustment (rekebisha ±)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{type === "restock" ? "Idadi" : "Idadi (±)"}</Label>
          <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Sababu / kumbukumbu</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Ghairi
        </Button>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          Hifadhi
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
