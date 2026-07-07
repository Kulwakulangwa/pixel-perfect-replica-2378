import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  CreditCard,
  Wallet,
  Printer,
  Loader2,
  Check,
  Wifi,
  WifiOff,
  Store,
} from "lucide-react";
import { format } from "date-fns";
import { get, set, del, keys } from "idb-keyval";

export const Route = createFileRoute("/_authenticated/pos")({
  ssr: false,
  component: PosPage,
});

// --- Types ---
type Product = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  image_url: string | null;
};

type CartItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  max_stock: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

type PendingSale = {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  customer_id: string | null;
  payment_method: "cash" | "credit";
  cashier_id: string;
  shop_id: string;
  receipt_number: string;
  created_at: string;
  synced: boolean;
};

type ReceiptSale = {
  receipt_number: string;
  created_at: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "cash" | "credit";
  synced: boolean;
  customer?: Customer | null;
};

// --- Offline queue helpers ---
const OFFLINE_QUEUE_KEY = "offline_sales";

async function getOfflineQueue(): Promise<PendingSale[]> {
  const queue = await get(OFFLINE_QUEUE_KEY);
  return queue || [];
}

async function addToOfflineQueue(sale: PendingSale) {
  const queue = await getOfflineQueue();
  queue.push(sale);
  await set(OFFLINE_QUEUE_KEY, queue);
}

async function removeFromOfflineQueue(id: string) {
  let queue = await getOfflineQueue();
  queue = queue.filter((s) => s.id !== id);
  await set(OFFLINE_QUEUE_KEY, queue);
}

// --- Component ---
function PosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [discount, setDiscount] = useState(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<ReceiptSale | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Fetch products ---
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_products");
      if (error) throw error;
      return data as Product[];
    },
  });

  // --- Fetch customers (FIXED: alias customer_id as id) ---
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_customer_balances")
        .select("customer_id as id, name, phone, balance")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  // --- Get current user and shop ---
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: staffData } = useQuery({
    queryKey: ["currentStaff"],
    queryFn: async () => {
      if (!userData) return null;
      const { data, error } = await supabase
        .from("staff")
        .select("shop_id, can_discount, full_name")
        .eq("id", userData.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userData,
  });

  // --- Offline sync ---
  useEffect(() => {
    const syncOffline = async () => {
      const queue = await getOfflineQueue();
      setOfflineCount(queue.length);
      if (queue.length === 0 || !isOnline || syncing) return;

      setSyncing(true);
      try {
        for (const sale of queue) {
          const { error: saleError } = await supabase.from("sales").insert({
            id: sale.id,
            shop_id: sale.shop_id,
            cashier_id: sale.cashier_id,
            customer_id: sale.customer_id,
            receipt_number: sale.receipt_number,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            payment_method: sale.payment_method,
            sale_type: sale.payment_method === "credit" ? "credit" : "cash",
            status: "completed",
            created_at: sale.created_at,
            synced: true,
            lipa_namba_provider: null,
            till_session_id: null,
            client_ref: null,
          });
          if (saleError) {
            console.error("Sync error for sale", sale.id, saleError);
            continue;
          }
          for (const item of sale.items) {
            const { error: itemError } = await supabase.from("sale_items").insert({
              sale_id: sale.id,
              product_id: item.product_id,
              product_name: item.product_name,
              unit_price: item.unit_price,
              quantity: item.quantity,
              line_total: item.line_total,
            });
            if (itemError) {
              console.error("Item sync error", itemError);
            }
          }
          await removeFromOfflineQueue(sale.id);
          toast.success(`Sale ${sale.receipt_number} synced!`);
        }
        setOfflineCount(0);
        queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      } catch (e) {
        console.error("Sync error", e);
      } finally {
        setSyncing(false);
      }
    };

    syncOffline();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnline, syncing, queryClient]);

  // --- Cart helpers ---
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= existing.max_stock) {
          toast.error("Hakuna stock ya kutosha.");
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                line_total: (item.quantity + 1) * item.unit_price,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit_price: product.selling_price,
          quantity: 1,
          line_total: product.selling_price,
          max_stock: product.current_stock,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.product_id !== productId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.max_stock) {
              toast.error("Hakuna stock ya kutosha.");
              return item;
            }
            return { ...item, quantity: newQty, line_total: newQty * item.unit_price };
          })
          .filter(Boolean) as CartItem[],
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
  };

  const cartQtyFor = (productId: string) =>
    cart.find((item) => item.product_id === productId)?.quantity ?? 0;

  // --- Compute totals ---
  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const total = Math.max(0, subtotal - discount);

  // --- Checkout ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Hakuna bidhaa kwenye mkokoteni.");
      return;
    }
    if (paymentMethod === "credit" && !selectedCustomer) {
      toast.error("Tafadhali chagua mteja kwa mkopo.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const saleId = crypto.randomUUID();
      const shopId = staffData?.shop_id || "11111111-1111-1111-1111-111111111111";
      const cashierId = userData?.id;
      if (!cashierId) throw new Error("Hakuna cashier aliyeingia.");

      const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const saleData = {
        id: saleId,
        shop_id: shopId,
        cashier_id: cashierId,
        customer_id: selectedCustomer?.id || null,
        receipt_number: receiptNumber,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        sale_type: paymentMethod === "credit" ? "credit" : "cash",
        status: "completed",
        created_at: new Date().toISOString(),
        synced: false,
        items: cart,
      };

      if (isOnline) {
        const { error: saleError } = await supabase.from("sales").insert({
          id: saleId,
          shop_id: shopId,
          cashier_id: cashierId,
          customer_id: selectedCustomer?.id || null,
          receipt_number: receiptNumber,
          subtotal,
          discount,
          total,
          payment_method: paymentMethod,
          sale_type: paymentMethod === "credit" ? "credit" : "cash",
          status: "completed",
          created_at: saleData.created_at,
          synced: true,
          lipa_namba_provider: null,
          till_session_id: null,
          client_ref: null,
        });
        if (saleError) throw saleError;

        for (const item of cart) {
          const { error: itemError } = await supabase.from("sale_items").insert({
            sale_id: saleId,
            product_id: item.product_id,
            product_name: item.product_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total: item.line_total,
          });
          if (itemError) throw itemError;
        }

        toast.success("Mauzo yamehifadhiwa!");
        setLastSaleReceipt({
          ...saleData,
          synced: true,
          customer: selectedCustomer,
        });
        setShowReceipt(true);
        clearCart();
      } else {
        await addToOfflineQueue({
          ...saleData,
          synced: false,
        } as PendingSale);
        setOfflineCount((prev) => prev + 1);
        toast.warning("Mauzo yamehifadhiwa ndani. Yatasambazwa mtandao ukipatikana.");
        setLastSaleReceipt({
          ...saleData,
          synced: false,
          customer: selectedCustomer,
        });
        setShowReceipt(true);
        clearCart();
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Imeshindwa kuhifadhi mauzo. Jaribu tena.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // --- Filter products ---
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())),
  );

  // --- Keyboard shortcut ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Receipt preview ---
  function ReceiptPreview({ sale, onClose }: { sale: ReceiptSale; onClose: () => void }) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden shadow-2xl">
          <div className="bg-blue-600 dark:bg-blue-700 px-6 pt-6 pb-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-base font-medium">
                Risiti ya Mauzo
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 text-center">
              <div className="font-semibold text-lg tracking-tight">Wakuja Shop</div>
              <div className="text-xs text-blue-100 mt-1">Risiti #{sale.receipt_number}</div>
              <div className="text-xs text-blue-100">
                {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4 text-sm dark:bg-[#1a1a1a]">
            <div className="divide-y divide-border dark:divide-border/30">
              {sale.items.map((item: CartItem) => (
                <div key={item.product_id} className="flex justify-between py-1.5">
                  <span className="text-foreground/90 dark:text-slate-200">
                    {item.product_name}
                    <span className="text-muted-foreground dark:text-slate-400"> &times;{item.quantity}</span>
                  </span>
                  <span className="tabular-nums font-medium dark:text-slate-200">
                    {formatCurrency(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-border dark:border-border/30 pt-3 space-y-1.5">
              <div className="flex justify-between text-muted-foreground dark:text-slate-400">
                <span>Jumla ndogo</span>
                <span className="tabular-nums">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Punguzo</span>
                  <span className="tabular-nums">-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-semibold dark:text-slate-200">Jumla</span>
                <span className="font-semibold text-xl tabular-nums dark:text-slate-200">
                  {formatCurrency(sale.total)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground dark:text-slate-400 pt-1">
                <span>Malipo</span>
                <span className="font-medium text-foreground dark:text-slate-200">
                  {sale.payment_method === "cash" ? "Fedha" : "Mkopo"}
                </span>
              </div>
              {sale.customer && (
                <div className="flex justify-between text-muted-foreground dark:text-slate-400">
                  <span>Mteja</span>
                  <span className="font-medium text-foreground dark:text-slate-200">{sale.customer.name}</span>
                </div>
              )}
            </div>

            {sale.payment_method === "credit" && sale.customer && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-4 py-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-amber-800 dark:text-amber-300 text-sm font-medium">Malipo yajayo</span>
                  <span className="text-amber-900 dark:text-amber-200 font-semibold tabular-nums">
                    {formatCurrency(sale.customer.balance + sale.total)}
                  </span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300/70 mt-1">
                  Salio la deni lote la {sale.customer.name}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground dark:text-slate-400 pt-1">
              {sale.synced ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Imesambazwa
                </>
              ) : (
                <>
                  <Loader2 className="h-3 w-3" /> Inasubiri mtandao
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 px-6 pb-6 dark:bg-[#1a1a1a]">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Funga
            </Button>
            <Button
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" /> Chapisha
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // --- Currency formatter ---
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
    }).format(value);

  const today = format(new Date(), "EEEE, d MMMM yyyy");
  const cashierName = staffData?.full_name || "Cashier";

  return (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400 uppercase">
                POS
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-slate-200">
              Karibu, {cashierName}
            </h1>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isOnline ? (
              <Badge className="gap-1.5 rounded-full border-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium px-3 py-1.5">
                <Wifi className="h-3 w-3" /> Mtandao
              </Badge>
            ) : (
              <Badge className="gap-1.5 rounded-full border-0 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium px-3 py-1.5">
                <WifiOff className="h-3 w-3" /> Nje ya mtandao
              </Badge>
            )}
            {offlineCount > 0 && (
              <Badge className="gap-1.5 rounded-full border-0 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium px-3 py-1.5">
                {syncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {offlineCount} zinazosubiri
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: Products */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tafuta bidhaa (Ctrl+K)..."
                className="pl-11 h-11 rounded-xl border-border/80 dark:border-slate-700 bg-card dark:bg-[#1a1a1a] shadow-sm focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
              />
            </div>
            <ScrollArea className="h-[60vh] rounded-2xl border border-border/70 dark:border-slate-700 bg-muted/20 dark:bg-slate-800/30">
              {productsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground dark:text-slate-400 text-sm">
                  Hakuna bidhaa zilizopatikana.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
                  {filteredProducts.map((product) => {
                    const lowStock = product.current_stock <= product.minimum_stock;
                    const qty = cartQtyFor(product.id);
                    const outOfStock = product.current_stock <= 0;
                    const atMax = qty >= product.current_stock;
                    return (
                      <div
                        key={product.id}
                        className={`rounded-2xl border bg-card dark:bg-[#1a1a1a] p-3 flex flex-col transition-colors ${
                          qty > 0
                            ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900"
                            : "border-border/70 dark:border-slate-700"
                        } ${outOfStock ? "opacity-50" : "hover:shadow-md hover:-translate-y-0.5 transition-all"}`}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded-xl mb-2"
                          />
                        ) : (
                          <div className="w-full h-20 rounded-xl mb-2 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-300 dark:text-blue-400 text-sm font-medium">
                            {product.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`self-start text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-1 ${
                            lowStock
                              ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                              : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          Stock: {product.current_stock}
                        </span>
                        <div className="font-medium text-sm leading-snug line-clamp-2 mb-0.5 dark:text-slate-200">
                          {product.name}
                        </div>
                        <div className="text-sm font-semibold text-foreground/90 dark:text-slate-300 tabular-nums mb-2">
                          {formatCurrency(product.selling_price)}
                        </div>

                        <div className="mt-auto flex items-center justify-between rounded-full border border-border/70 dark:border-slate-700 bg-muted/30 dark:bg-slate-700/30 px-1 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full dark:text-slate-300"
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={qty === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium tabular-nums w-5 text-center dark:text-slate-200">
                            {qty}
                          </span>
                          <Button
                            size="icon"
                            className="h-6 w-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-muted dark:disabled:bg-slate-600 disabled:text-muted-foreground dark:disabled:text-slate-400"
                            onClick={() => addToCart(product)}
                            disabled={outOfStock || atMax}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right column: Cart */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 dark:border-slate-700 bg-card dark:bg-[#1a1a1a] shadow-sm p-4 h-[60vh] flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-base dark:text-slate-200">Mkokoteni</h3>
                <Badge className="rounded-full border-0 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                  {cart.length} bidhaa
                </Badge>
              </div>
              <ScrollArea className="flex-1 -mx-1 px-1">
                {cart.length === 0 ? (
                  <div className="text-center text-muted-foreground dark:text-slate-400 py-10">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Mkokoteni uko wazi</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center justify-between bg-muted/40 dark:bg-slate-700/30 rounded-xl p-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate dark:text-slate-200">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground dark:text-slate-400 tabular-nums">
                            {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-card dark:bg-[#1a1a1a] rounded-full border border-border/70 dark:border-slate-700 px-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full dark:text-slate-300"
                            onClick={() => updateQuantity(item.product_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-sm tabular-nums dark:text-slate-200">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full dark:text-slate-300"
                            onClick={() => updateQuantity(item.product_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <div className="text-sm font-medium ml-2 tabular-nums w-16 text-right dark:text-slate-200">
                          {formatCurrency(item.line_total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t border-dashed border-border dark:border-slate-700 pt-3 space-y-1.5 mt-2">
                <div className="flex justify-between text-sm text-muted-foreground dark:text-slate-400">
                  <span>Jumla ndogo</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Punguzo</span>
                    <span className="tabular-nums">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold dark:text-slate-200">Jumla</span>
                  <span className="font-semibold text-xl tabular-nums dark:text-slate-200">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="border-t border-border/70 dark:border-slate-700 pt-3 mt-3 space-y-2.5">
                <div className="flex gap-2">
                  <Select
                    value={paymentMethod}
                    onValueChange={(v: "cash" | "credit") => setPaymentMethod(v)}
                  >
                    <SelectTrigger className="flex-1 rounded-xl h-10 dark:bg-[#1a1a1a] dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <Wallet className="h-4 w-4 mr-2 inline" /> Fedha
                      </SelectItem>
                      <SelectItem value="credit">
                        <CreditCard className="h-4 w-4 mr-2 inline" /> Mkopo
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {paymentMethod === "credit" && (
                    <Select
                      value={selectedCustomer?.id || ""}
                      onValueChange={(id) => {
                        const customer = customers.find((c) => c.id === id);
                        setSelectedCustomer(customer || null);
                      }}
                    >
                      <SelectTrigger className="flex-1 rounded-xl h-10 dark:bg-[#1a1a1a] dark:border-slate-700">
                        <SelectValue placeholder="Chagua mteja" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} (Salio: {formatCurrency(c.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {staffData?.can_discount && (
                  <div className="flex gap-2 items-center bg-muted/30 dark:bg-slate-700/30 rounded-xl px-3 py-2">
                    <Label className="text-sm whitespace-nowrap text-muted-foreground dark:text-slate-400">
                      Punguzo
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="w-24 h-8 rounded-lg bg-card dark:bg-[#1a1a1a] dark:border-slate-700"
                    />
                    <span className="text-sm text-muted-foreground dark:text-slate-400 ml-auto tabular-nums">
                      {formatCurrency(discount)}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl dark:border-slate-700 dark:text-slate-200"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                  >
                    Futa
                  </Button>
                  <Button
                    className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                    onClick={handleCheckout}
                    disabled={
                      cart.length === 0 ||
                      isCheckingOut ||
                      (paymentMethod === "credit" && !selectedCustomer)
                    }
                  >
                    {isCheckingOut ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                    {isCheckingOut ? "Inahifadhi..." : "Maliza Mauzo"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReceipt && lastSaleReceipt && (
        <ReceiptPreview sale={lastSaleReceipt} onClose={() => setShowReceipt(false)} />
      )}
    </AppShell>
  );
}
