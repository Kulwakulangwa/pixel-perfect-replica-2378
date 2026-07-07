import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfToday, endOfToday } from "date-fns";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, ShoppingBag, CreditCard, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/today")({
  ssr: false,
  component: TodayPage,
});

type TodaySale = {
  id: string;
  receipt_number: string;
  total: number;
  payment_method: string;
  sale_type: string;
  customer_id: string | null;
  cashier_id: string;
  created_at: string;
  customers: {
    name: string | null;
  } | null;
};

type TodaySummary = {
  total_revenue: number;
  total_sales: number;
  total_cash: number;
  total_credit: number;
  average_sale: number;
};

function TodayPage() {
  const [dateDescription, setDateDescription] = useState("");
  useEffect(() => {
    setDateDescription(format(new Date(), "EEEE, dd MMMM yyyy"));
  }, []);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["currentStaff"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("staff")
        .select("id, role")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch today's sales
  const { data, isLoading, error } = useQuery({
    queryKey: ["todaySales"],
    queryFn: async () => {
      if (!staff) return null;
      const today = new Date();
      const from = startOfToday().toISOString();
      const to = endOfToday().toISOString();

      // First: fetch all sales with cashier_id
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          receipt_number,
          total,
          payment_method,
          sale_type,
          customer_id,
          cashier_id,
          created_at,
          customers ( name )
        `)
        .gte("created_at", from)
        .lte("created_at", to)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // Second: fetch cashier names for all unique cashier_ids
      const cashierIds = [...new Set(sales?.map(s => s.cashier_id).filter(Boolean))];
      let cashierNames: Record<string, string> = {};
      if (cashierIds.length > 0) {
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("id, full_name")
          .in("id", cashierIds);
        if (!staffError) {
          cashierNames = staffData.reduce((acc, cur) => {
            acc[cur.id] = cur.full_name || cur.id;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Attach cashier name to each sale
      const enrichedSales = sales?.map(sale => ({
        ...sale,
        cashier_name: cashierNames[sale.cashier_id] || sale.cashier_id,
      })) || [];

      const totalRevenue = enrichedSales.reduce((sum, s) => sum + s.total, 0) || 0;
      const totalSales = enrichedSales.length || 0;
      const totalCash = enrichedSales
        .filter(s => s.payment_method === "cash")
        .reduce((sum, s) => sum + s.total, 0) || 0;
      const totalCredit = enrichedSales
        .filter(s => s.payment_method === "credit")
        .reduce((sum, s) => sum + s.total, 0) || 0;
      const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;

      return {
        sales: enrichedSales,
        summary: {
          total_revenue: totalRevenue,
          total_sales: totalSales,
          total_cash: totalCash,
          total_credit: totalCredit,
          average_sale: averageSale,
        },
      };
    },
    enabled: !!staff,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
    }).format(value);

  const formatTime = (iso: string) => format(new Date(iso), "HH:mm");

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="text-red-500 p-4">Imeshindwa kupakia mauzo ya leo. Jaribu tena.</div>
      </AppShell>
    );
  }

  const { sales, summary } = data;

  return (
    <AppShell>
      <PageHeader title="Mauzo ya Leo" description={dateDescription} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jumla ya Mauzo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">{summary.total_sales} mauzo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fedha</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.total_cash)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mkopo</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.total_credit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wastani wa Mauzo</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.average_sale)}</div>
          </CardContent>
        </Card>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risiti</TableHead>
              <TableHead>Mteja</TableHead>
              <TableHead>Jumla</TableHead>
              <TableHead>Malipo</TableHead>
              <TableHead>Saa</TableHead>
              <TableHead>Aliyeuza</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Hakuna mauzo leo.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.receipt_number}</TableCell>
                  <TableCell>{sale.customers?.name || "Mteja wa Oda"}</TableCell>
                  <TableCell>{formatCurrency(sale.total)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sale.payment_method === "cash" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
                    >
                      {sale.payment_method === "cash" ? "Fedha" : "Mkopo"}
                    </span>
                  </TableCell>
                  <TableCell>{formatTime(sale.created_at)}</TableCell>
                  <TableCell className="text-sm">{sale.cashier_name}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
