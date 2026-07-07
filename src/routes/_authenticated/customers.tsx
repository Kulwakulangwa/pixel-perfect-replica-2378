import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, PageHeader } from "@/components/app-shell";
import { format } from "date-fns";
import { Loader2, UserPlus, Users, DollarSign, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  ssr: false,
  component: CustomersPage,
});

// --- Types ---
type CustomerBalance = {
  customer_id: string;   // actual column name
  name: string;
  phone: string | null;
  balance: number;
};

type CustomerSale = {
  id: string;
  total: number;
  created_at: string;
  status: string;
};

type CustomerPayment = {
  id: string;
  amount: number;
  payment_date: string;
  note: string | null;
};

// --- Stat card helper ---
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

// --- Queries & Mutations ---
const fetchCustomers = async (): Promise<CustomerBalance[]> => {
  const { data, error } = await supabase
    .from("v_customer_balances")
    .select("customer_id, name, phone, balance")
    .order("name");
  if (error) throw error;
  return data || [];
};

const fetchCustomerSales = async (customerId: string): Promise<CustomerSale[]> => {
  const { data, error } = await supabase
    .from("sales")
    .select("id, total, created_at, status")
    .eq("customer_id", customerId)
    .eq("sale_type", "credit")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchCustomerPayments = async (customerId: string): Promise<CustomerPayment[]> => {
  const { data, error } = await supabase
    .from("customer_payments")
    .select("*")
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data || [];
};

const addCustomer = async (name: string, phone?: string) => {
  const { data: shopId, error: shopError } = await supabase.rpc("current_shop_id");
  if (shopError) throw shopError;
  if (!shopId) throw new Error("No shop found for this user.");
  const { error } = await supabase
    .from("customers")
    .insert([{ shop_id: shopId, name, phone: phone || null }]);
  if (error) throw error;
};

const recordPayment = async (
  customerId: string,
  amount: number,
  paymentDate: string,
  note?: string,
) => {
  const { error } = await supabase
    .from("customer_payments")
    .insert([{ customer_id: customerId, amount, payment_date: paymentDate, note: note || null }]);
  if (error) throw error;
};

// --- Component ---
function CustomersPage() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const {
    data: customers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["customerSales", selectedCustomerId],
    queryFn: () => fetchCustomerSales(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["customerPayments", selectedCustomerId],
    queryFn: () => fetchCustomerPayments(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const addCustomerMutation = useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) => addCustomer(name, phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setAddDialogOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    },
    onError: (err) => {
      alert("Imeshindwa kuongeza mteja: " + (err as Error).message);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({
      customerId,
      amount,
      paymentDate,
      note,
    }: {
      customerId: string;
      amount: number;
      paymentDate: string;
      note?: string;
    }) => recordPayment(customerId, amount, paymentDate, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customerPayments", selectedCustomerId] });
    },
  });

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDetailOpen(true);
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    addCustomerMutation.mutate({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || undefined,
    });
  };

  const handleRecordPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const amount = parseFloat(formData.get("amount") as string);
    const paymentDate = formData.get("paymentDate") as string;
    const note = formData.get("note") as string;
    if (!selectedCustomerId || isNaN(amount) || amount <= 0) return;
    recordPaymentMutation.mutate({
      customerId: selectedCustomerId,
      amount,
      paymentDate,
      note: note || undefined,
    });
    form.reset();
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
    }).format(value);

  const totalCustomers = customers.length;
  const totalDebt = customers.reduce((sum, c) => sum + c.balance, 0);
  const withPhone = customers.filter((c) => c.phone).length;

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Customers"
          description="Manage your customers and their balances"
          action={
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  <UserPlus className="mr-2 h-4 w-4" /> Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-[#1a1a1a] dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle className="dark:text-slate-200">Add New Customer</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Name *</Label>
                    <Input
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="e.g., John Doe"
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone (optional)</Label>
                    <Input
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="0712345678"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addCustomerMutation.isPending} className="rounded-xl">
                      {addCustomerMutation.isPending ? <Loader2 className="animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Customers"
            value={String(totalCustomers)}
            icon={Users}
            variant="dark"
          />
          <StatCard
            label="Total Outstanding Debt"
            value={formatCurrency(totalDebt)}
            icon={DollarSign}
            variant="rose"
          />
          <StatCard
            label="With Phone"
            value={String(withPhone)}
            sub={`${totalCustomers > 0 ? Math.round((withPhone / totalCustomers) * 100) : 0}%`}
            icon={Phone}
            variant="mint"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="text-red-500">Failed to load customers. Try again.</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground dark:text-slate-400">
            No customers yet. Add your first customer.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.customer_id}
                    className="cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/20"
                    onClick={() => handleCustomerClick(customer.customer_id)}
                  >
                    <TableCell className="font-medium dark:text-slate-200">{customer.name}</TableCell>
                    <TableCell className="dark:text-slate-300">{customer.phone || "-"}</TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${customer.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {formatCurrency(customer.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCustomerClick(customer.customer_id);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detail Modal */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto dark:bg-[#1a1a1a] dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-200">Customer Details</DialogTitle>
            </DialogHeader>
            {selectedCustomerId && (
              <Tabs defaultValue="purchases" className="mt-4">
                <TabsList className="grid w-full grid-cols-3 dark:bg-slate-800">
                  <TabsTrigger value="purchases" className="dark:data-[state=active]:bg-slate-700">Purchases</TabsTrigger>
                  <TabsTrigger value="payments" className="dark:data-[state=active]:bg-slate-700">Payments</TabsTrigger>
                  <TabsTrigger value="record" className="dark:data-[state=active]:bg-slate-700">Record Payment</TabsTrigger>
                </TabsList>
                <TabsContent value="purchases" className="space-y-4">
                  {salesLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : sales.length === 0 ? (
                    <p className="text-muted-foreground dark:text-slate-400">No credit purchases for this customer.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell>{format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
                            <TableCell>{sale.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
                <TabsContent value="payments" className="space-y-4">
                  {paymentsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : payments.length === 0 ? (
                    <p className="text-muted-foreground dark:text-slate-400">No payments recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{format(new Date(payment.payment_date), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{payment.note || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
                <TabsContent value="record">
                  <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
                    <div>
                      <Label htmlFor="amount">Amount (TZS)</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="15000"
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentDate">Payment Date</Label>
                      <Input
                        id="paymentDate"
                        name="paymentDate"
                        type="date"
                        defaultValue={new Date().toISOString().split("T")[0]}
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="note">Note (optional)</Label>
                      <Input
                        id="note"
                        name="note"
                        placeholder="e.g., Second installment"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={recordPaymentMutation.isPending} className="rounded-xl">
                        {recordPaymentMutation.isPending ? <Loader2 className="animate-spin" /> : "Record Payment"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
