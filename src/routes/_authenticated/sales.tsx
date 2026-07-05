import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Receipt as ReceiptIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  ssr: false,
  component: () => <AppShell requireOwner><SalesPage /></AppShell>,
});

type Sale = {
  id: string;
  receipt_number: string;
  total: number;
  sale_type: string;
  payment_method: string | null;
  lipa_namba_provider: string | null;
  status: string;
  created_at: string;
  cashier_id: string;
  customer_id: string | null;
  customer?: { name: string } | null;
};

function SalesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["sales-list", type],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("id, receipt_number, total, sale_type, payment_method, lipa_namba_provider, status, created_at, cashier_id, customer_id, customer:customers(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (type !== "all") query = query.eq("sale_type", type as "cash" | "credit");
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Sale[];
    },
  });

  const filtered = (data ?? []).filter((s) => !q || s.receipt_number.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Mauzo" description="Historia ya mauzo yote." />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tafuta risiti..." className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Aina zote</SelectItem>
            <SelectItem value="cash">Cash / Lipa Namba</SelectItem>
            <SelectItem value="credit">Deni</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-elev divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-12 text-center"><ReceiptIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Hakuna mauzo.</p></div>
        )}
        {filtered.map((s) => (
          <Link key={s.id} to="/sales/$id" params={{ id: s.id }} className="flex items-center justify-between p-4 hover:bg-accent/40">
            <div>
              <div className="font-medium text-sm">#{s.receipt_number}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString()} ·{" "}
                {s.sale_type === "credit" ? `Deni · ${s.customer?.name ?? "Mteja"}` : s.payment_method === "lipa_namba" ? `Lipa Namba (${s.lipa_namba_provider ?? "?"})` : "Cash"}
                {s.status === "voided" && " · IMEFUTWA"}
              </div>
            </div>
            <div className={`font-semibold ${s.status === "voided" ? "line-through text-muted-foreground" : ""}`}>{formatMoney(s.total)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
