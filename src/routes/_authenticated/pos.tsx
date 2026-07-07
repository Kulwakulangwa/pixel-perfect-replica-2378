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
  payment_method: "cash" | "credit"; // this is actually sale_type in DB, but we keep for compatibility
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

  // --- Fetch customers (NO ALIAS IN SELECT – map in JS) ---
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_customer_balances")
        .select("customer_id, name, phone, balance")
        .order("name");
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.customer_id,
        name: item.name,
        phone: item.phone,
        balance: item.balance,
      })) as Customer[];
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
      if (error) {
        console.error("Error fetching staff data:", error);
        return null;
      }
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
            payment_method: 'cash', // always cash in DB
            sale_type: sale.payment_method === 'credit' ? 'credit' : 'cash',
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

  // --- Checkout with fixed enums ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Hakuna bidhaa kwenye mkokoteni.");
      return;
    }
    if (paymentMethod === "credit" && !selectedCustomer) {
      toast.error("Tafadhali chagua mteja kwa mkopo.");
      return;
    }

    const shopId = staffData?.shop_id || "11111111-1111-1111-1111-111111111111";
    const cashierId = userData?.id;
    if (!cashierId) {
      toast.error("Hakuna cashier aliyeingia.");
      return;
    }

    if (!shopId) {
      toast.error("Duka halijapatikana. Tafadhali ingia tena.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const saleId = crypto.randomUUID();
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
        // For DB: payment_method is always 'cash' for now; sale_type indicates credit/cash
        payment_method_type: paymentMethod, // we keep this for receipt display
        // Real DB fields
        db_payment_method: 'cash',
        db_sale_type: paymentMethod === 'credit' ? 'credit' : 'cash',
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
          payment_method: 'cash', // always cash in DB
          sale_type: paymentMethod === 'credit' ? 'credit' : 'cash',
          status: "completed",
          created_at: saleData.created_at,
          synced: true,
          lipa_namba_provider: null,
          till_session_id: null,
          client_ref: null,
        });
        if (saleError) {
          console.error("Sale insert error:", saleError);
          const errorMsg = saleError.message || JSON.stringify(saleError);
          toast.error("Imeshindwa kuhifadhi mauzo: " + errorMsg);
          throw saleError;
        }

        for (const item of cart) {
          const { error: itemError } = await supabase.from("sale_items").insert({
            sale_id: saleId,
            product_id: item.product_id,
            product_name: item.product_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total: item.line_total,
          });
          if (itemError) {
            console.error("Item insert error:", itemError);
            throw itemError;
          }
        }

        toast.success("Mauzo yamehifadhiwa!");
        setLastSaleReceipt({
          receipt_number: receiptNumber,
          created_at: saleData.created_at,
          items: cart,
          subtotal,
          discount,
          total,
          payment_method: paymentMethod, // show credit/cash on receipt
          synced: true,
          customer: selectedCustomer,
        });
        setShowReceipt(true);
        clearCart();
      } else {
        await addToOfflineQueue({
          id: saleId,
          items: cart,
          subtotal,
          discount,
          total,
          customer_id: selectedCustomer?.id || null,
          payment_method: paymentMethod, // store the user-selected method for sync
          cashier_id: cashierId,
          shop_id: shopId,
          receipt_number: receiptNumber,
          created_at: saleData.created_at,
          synced: false,
        });
        setOfflineCount((prev) => prev + 1);
        toast.warning("Mauzo yamehifadhiwa ndani. Yatasambazwa mtandao ukipatikana.");
        setLastSaleReceipt({
          receipt_number: receiptNumber,
          created_at: saleData.created_at,
          items: cart,
          subtotal,
          discount,
          total,
          payment_method: paymentMethod,
          synced: false,
          customer: selectedCustomer,
        });
        setShowReceipt(true);
        clearCart();
      }
    } catch (error) {
      console.error("Checkout error:", error);
      if (!(error instanceof Error && error.message.includes("Imeshindwa"))) {
        toast.error("Imeshindwa kuhifadhi mauzo. Tafadhali angalia console kwa maelezo.");
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ... rest of the file (filteredProducts, keyboard shortcut, ReceiptPreview, formatCurrency, return JSX) stays the same ...
