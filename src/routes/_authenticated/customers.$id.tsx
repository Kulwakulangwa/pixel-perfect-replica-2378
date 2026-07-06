import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  ssr: false,
  component: () => <AppShell requireOwner><CustomerDetailPage /></AppShell>,
});

// --- Types ---
type CustomerBalance = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  shop_id: string;
};

type CustomerSale = {
  id: string;
  receipt_number: string;
  total: number;
  created_at: string;
  payment_method: string;
  sale_type: string;
  status: string;
};

type CustomerPayment = {
  id: string;
  amount: number;
  payment_date: string;
  note: string | null;
};

// --- Query functions ---
const fetchCustomer = async (id: string): Promise<CustomerBalance> => {
  const { data, error } = await supabase
    .from("v_customer_balances")
    .select("id, name, phone, balance, shop_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

const fetchCustomerSales = async (customerId: string): Promise<CustomerSale[]> => {
  const { data, error } = await supabase
    .from("sales")
    .select("id, receipt_number, total, created_at, payment_method, sale_type, status")
    .eq("customer_id", customerId)
    .eq("sale_type", "credit")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchCustomerPayments = async (customerId: string): Promise<CustomerPayment[]> => {
  const { data, error } = await supabase
    .from("customer_payments")
    .select("id, amount, payment_date, note")
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data || [];
};

// --- Mutation to record payment ---
const recordPayment = async ({
  customerId,
  amount,
  paymentDate,
  note,
}: {
  customerId: string;
  amount: number;
  paymentDate: string;
  note?: string;
}) => {
  // Get current user for recorded_by
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Hakuna mtumiaji aliyeingia.");

  const { error } = await supabase.from("customer_payments").insert({
    customer_id: customerId,
    amount,
    payment_date: paymentDate,
    note: note || null,
    recorded_by: user.id,
    shop_id: (await fetchCustomer(customerId)).shop_id, // shop_id from customer
    payment_method: "cash", // default for manual entry; could be made selectable
  });
  if (error) throw error;
};

// --- Component ---
function CustomerDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  // Form state
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
  });

  const {
    data: sales = [],
    isLoading: salesLoading,
    error: salesError,
  } = useQuery({
    queryKey: ["customerSales", id],
    queryFn: () => fetchCustomerSales(id),
    enabled: !!customer,
  });

  const {
    data: payments = [],
    isLoading: paymentsLoading,
    error: paymentsError,
  } = useQuery({
    queryKey: ["customerPayments", id],
    queryFn: () => fetchCustomerPayments(id),
    enabled: !!customer,
  });

  // Mutation for recording payment
  const paymentMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customerSales", id] });
      queryClient.invalidateQueries({ queryKey: ["customerPayments", id] });
      // Also invalidate the customers list (for balance update)
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Malipo yamehifadhiwa!");
      setPaymentAmount("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentNote("");
    },
    onError: (error) => {
      toast.error("Imeshindwa kuhifadhi malipo: " + (error as Error).message);
    },
  });

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (!customer) return;
    if (isNaN(amount) || amount <= 0) {
      toast.error("Tafadhali weka kiasi halali.");
      return;
    }
    if (!paymentDate) {
      toast.error("Tafadhali weka tarehe ya malipo.");
      return;
    }
    setIsSubmitting(true);
    paymentMutation.mutate(
      {
        customerId: customer.id,
        amount,
        paymentDate,
        note: paymentNote.trim() || undefined,
      },
      {
        onSettled: () => setIsSubmitting(false),
      }
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd/MM/yyyy HH:mm");

  // Loading & error states
  if (customerLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (customerError || !customer) {
    return (
      <AppShell>
        <div className="text-red-500 p-4">Imeshindwa kupakia mteja. Jaribu tena.</div>
      </AppShell>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title={customer.name}
        description={customer.phone || "Hakuna simu"}
        action={
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Salio la sasa</div>
            <div className={`text-2xl font-bold ${customer.balance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(customer.balance)}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manunuzi ya Mkopo</CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : salesError ? (
              <div className="text-sm text-red-500">Imeshindwa kupakia manunuzi.</div>
            ) : sales.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Hakuna manunuzi ya mkopo kwa mteja huyu.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risiti</TableHead>
                    <TableHead className="text-right">Kiasi</TableHead>
                    <TableHead>Tarehe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.receipt_number}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className="text-xs">{formatDate(sale.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historia ya Malipo</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : paymentsError ? (
              <div className="text-sm text-red-500">Imeshindwa kupakia malipo.</div>
            ) : payments.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Hakuna malipo yaliyorekodiwa.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kiasi</TableHead>
                    <TableHead>Tarehe</TableHead>
                    <TableHead>Maelezo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-green-600">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-xs">{format(new Date(p.payment_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">{p.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Form */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Rekodi Malipo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="paymentAmount">Kiasi (TZS)</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="50000"
                required
              />
            </div>
            <div>
              <Label htmlFor="paymentDate">Tarehe</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="paymentNote">Maelezo (hiari)</Label>
              <Input
                id="paymentNote"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Malipo ya awamu"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={isSubmitting || paymentMutation.isPending}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                {isSubmitting ? "Inahifadhi..." : "Rekodi Malipo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
