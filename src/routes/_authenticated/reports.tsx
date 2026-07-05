import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  component: ReportsPage,
});

type ReportType = "daily" | "weekly" | "monthly" | "bestsellers" | "profit" | "expenses";

// --- Types for data fetched ---
type Sale = {
  id: string;
  created_at: string;
  total: number;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  products: {
    id: string;
    name: string;
    buying_price: number;
  };
};

type Expense = {
  id: string;
  amount: number;
  category: string;
  expense_date: string;
};

// --- Fetch functions ---
const fetchSalesData = async (from: string, to: string) => {
  const { data, error } = await supabase
    .from("sales")
    .select("id, created_at, total")
    .gte("created_at", from)
    .lte("created_at", to)
    .eq("status", "completed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Sale[];
};

const fetchSaleItems = async (saleIds: string[]) => {
  if (saleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      id,
      sale_id,
      product_id,
      quantity,
      selling_price,
      products (
        id,
        name,
        buying_price
      )
    `)
    .in("sale_id", saleIds);
  if (error) throw error;
  return data as SaleItem[];
};

const fetchExpenses = async (from: string, to: string) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, category, expense_date")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: true });
  if (error) throw error;
  return data as Expense[];
};

// --- Helper to get date range for report type ---
const getDefaultDateRange = (reportType: ReportType) => {
  const now = new Date();
  let from: Date, to: Date;
  switch (reportType) {
    case "daily":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;
    case "weekly":
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "monthly":
      from = startOfMonth(now);
      to = endOfMonth(now);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
  };
};

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Set default date range when report type changes
  useMemo(() => {
    const { from, to } = getDefaultDateRange(reportType);
    setFromDate(from);
    setToDate(to);
  }, [reportType]);

  // --- Fetch data ---
  const salesQuery = useQuery({
    queryKey: ["salesData", fromDate, toDate],
    queryFn: () => fetchSalesData(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });

  const saleItemsQuery = useQuery({
    queryKey: ["saleItems", salesQuery.data?.map(s => s.id)],
    queryFn: () => fetchSaleItems(salesQuery.data?.map(s => s.id) || []),
    enabled: !!salesQuery.data && salesQuery.data.length > 0,
  });

  const expensesQuery = useQuery({
    queryKey: ["expensesData", fromDate, toDate],
    queryFn: () => fetchExpenses(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });

  const isLoading = salesQuery.isLoading || saleItemsQuery.isLoading || expensesQuery.isLoading;
  const error = salesQuery.error || saleItemsQuery.error || expensesQuery.error;

  // --- Compute reports ---
  const reportData = useMemo(() => {
    if (!salesQuery.data || !saleItemsQuery.data || !expensesQuery.data) return null;

    const sales = salesQuery.data;
    const items = saleItemsQuery.data;
    const expenses = expensesQuery.data;

    // 1. Daily, weekly, monthly sales: group sales by period
    const groupSales = (groupFn: (date: Date) => string) => {
      const groups: { [key: string]: number } = {};
      sales.forEach(sale => {
        const key = groupFn(new Date(sale.created_at));
        groups[key] = (groups[key] || 0) + sale.total;
      });
      // Convert to array sorted
      return Object.entries(groups)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => a.label.localeCompare(b.label));
    };

    let salesReport: { label: string; total: number }[] = [];
    let periodLabel = "";
    switch (reportType) {
      case "daily":
        periodLabel = "Tarehe";
        salesReport = groupSales(d => format(d, "yyyy-MM-dd"));
        break;
      case "weekly":
        periodLabel = "Wiki";
        salesReport = groupSales(d => `Wiki ${format(d, "w, yyyy")}`);
        break;
      case "monthly":
        periodLabel = "Mwezi";
        salesReport = groupSales(d => format(d, "MMM yyyy"));
        break;
      default:
        break;
    }

    // 2. Best sellers
    const bestSellers = () => {
      const productSales: { [productId: string]: { name: string; quantity: number; revenue: number } } = {};
      items.forEach(item => {
        const p = item.products;
        if (!p) return;
        if (!productSales[p.id]) {
          productSales[p.id] = { name: p.name, quantity: 0, revenue: 0 };
        }
        productSales[p.id].quantity += item.quantity;
        productSales[p.id].revenue += item.quantity * item.selling_price;
      });
      return Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    };

    // 3. Profit
    const profit = () => {
      let totalProfit = 0;
      items.forEach(item => {
        const buyingPrice = item.products?.buying_price || 0;
        const profit = (item.selling_price - buyingPrice) * item.quantity;
        totalProfit += profit;
      });
      return totalProfit;
    };

    // 4. Expenses
    const expensesReport = () => {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      const byCategory: { [key: string]: number } = {};
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      });
      return { total, byCategory };
    };

    return {
      salesReport,
      periodLabel,
      bestSellers: bestSellers(),
      profit: profit(),
      expenses: expensesReport(),
    };
  }, [salesQuery.data, saleItemsQuery.data, expensesQuery.data, reportType]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  // --- Render report content ---
  const renderReport = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <div className="text-red-500">Imeshindwa kupakia ripoti. Jaribu tena.</div>;
    if (!reportData) return <div className="text-muted-foreground">Hakuna data kwa kipindi hiki.</div>;

    switch (reportType) {
      case "daily":
      case "weekly":
      case "monthly":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Jumla ya Mauzo: {formatCurrency(reportData.salesReport.reduce((sum, r) => sum + r.total, 0))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{reportData.periodLabel}</TableHead>
                  <TableHead className="text-right">Jumla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.salesReport.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "bestsellers":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">Bidhaa Zinazouza Sana</div>
            {reportData.bestSellers.length === 0 ? (
              <p className="text-muted-foreground">Hakuna mauzo katika kipindi hiki.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidhaa</TableHead>
                    <TableHead className="text-right">Idadi</TableHead>
                    <TableHead className="text-right">Mapato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.bestSellers.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );

      case "profit":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Faida Jumla: {formatCurrency(reportData.profit)}
            </div>
            <div className="text-muted-foreground">
              Faida inahesabiwa kwa kutoa bei ya ununuzi (buying price) kutoka bei ya kuuza (selling price) kwa kila bidhaa.
            </div>
          </div>
        );

      case "expenses":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Jumla ya Gharama: {formatCurrency(reportData.expenses.total)}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aina</TableHead>
                  <TableHead className="text-right">Kiasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(reportData.expenses.byCategory).map(([category, amount]) => (
                  <TableRow key={category}>
                    <TableCell className="capitalize">{category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppShell>
      <PageHeader title="Ripoti" description="Changanua mauzo, faida na gharama zako" />

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <Label htmlFor="reportType">Aina ya Ripoti</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Mauzo ya Siku</SelectItem>
              <SelectItem value="weekly">Mauzo ya Wiki</SelectItem>
              <SelectItem value="monthly">Mauzo ya Mwezi</SelectItem>
              <SelectItem value="bestsellers">Bidhaa Zinazouza Sana</SelectItem>
              <SelectItem value="profit">Faida</SelectItem>
              <SelectItem value="expenses">Gharama</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="fromDate">Kuanzia</Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="toDate">Mpaka</Label>
          <Input
            id="toDate"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const { from, to } = getDefaultDateRange(reportType);
              setFromDate(from);
              setToDate(to);
            }}
          >
            <Calendar className="mr-2 h-4 w-4" /> Sakinisha Tarehe
          </Button>
        </div>
      </div>

      {/* Report Output */}
      <div className="border rounded-lg p-4">
        {renderReport()}
      </div>
    </AppShell>
  );
}
