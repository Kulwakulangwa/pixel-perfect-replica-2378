// Simple offline queue for POS sales. Persists pending sales in IndexedDB
// so a cashier can complete transactions with no internet and they sync
// automatically once connectivity returns.
import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { newClientRef } from "@/lib/receipt-number";

export type PendingSaleItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type PendingSale = {
  client_ref: string;
  shop_id: string;
  cashier_id: string;
  receipt_number: string;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "cash" | "lipa_namba" | null;
  lipa_namba_provider: "mpesa" | "airtel_money" | "tigo_pesa" | null;
  sale_type: "cash" | "credit";
  till_session_id: string | null;
  items: PendingSaleItem[];
  queued_at: number;
};

const KEY_PREFIX = "wakuja:pending:";

export function makeClientRef() {
  return newClientRef();
}

export async function queueSale(sale: PendingSale) {
  await set(KEY_PREFIX + sale.client_ref, sale);
}

export async function removeFromQueue(clientRef: string) {
  await del(KEY_PREFIX + clientRef);
}

export async function listQueue(): Promise<PendingSale[]> {
  const allKeys = await keys();
  const out: PendingSale[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(KEY_PREFIX)) {
      const v = await get<PendingSale>(k);
      if (v) out.push(v);
    }
  }
  return out.sort((a, b) => a.queued_at - b.queued_at);
}

export type SyncResult = { synced: number; failed: number };

export async function syncPendingSales(): Promise<SyncResult> {
  const queue = await listQueue();
  let synced = 0;
  let failed = 0;
  for (const sale of queue) {
    try {
      const { data: saleRow, error: e1 } = await supabase
        .from("sales")
        .insert({
          shop_id: sale.shop_id,
          receipt_number: sale.receipt_number,
          cashier_id: sale.cashier_id,
          customer_id: sale.customer_id,
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          payment_method: sale.payment_method,
          lipa_namba_provider: sale.lipa_namba_provider,
          sale_type: sale.sale_type,
          till_session_id: sale.till_session_id,
          client_ref: sale.client_ref,
          synced: true,
        })
        .select("id")
        .single();
      if (e1) {
        // duplicate client_ref = already synced; drop from queue
        if (e1.code === "23505") {
          await removeFromQueue(sale.client_ref);
          synced++;
          continue;
        }
        throw e1;
      }
      const itemsPayload = sale.items.map((it) => ({
        sale_id: saleRow.id,
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: it.unit_price,
        quantity: it.quantity,
        line_total: it.line_total,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(itemsPayload);
      if (e2) throw e2;
      await removeFromQueue(sale.client_ref);
      synced++;
    } catch (err) {
      console.warn("[sync] failed", sale.client_ref, err);
      failed++;
    }
  }
  return { synced, failed };
}

let syncing = false;
export async function triggerSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    await syncPendingSales();
  } finally {
    syncing = false;
  }
}

export function startBackgroundSync() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => {
    void triggerSync();
  };
  const onFocus = () => {
    void triggerSync();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  const interval = window.setInterval(() => {
    void triggerSync();
  }, 30_000);
  void triggerSync();
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    window.clearInterval(interval);
  };
}
