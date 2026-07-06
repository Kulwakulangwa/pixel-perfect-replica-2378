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
import { Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  ssr: false,
  component: CustomersPage,
});

// --- Types ---
type CustomerBalance = {
  id: string;
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

// --- Queries ---
const fetchCustomers = async (): Promise<CustomerBalance[]> => {
  const { data, error } = await supabase.from("v_customer_balances").select("*");
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

// --- Mutations ---
const addCustomer = async (name: string, phone?: string) => {
  const { error } = await supabase.from("customers").insert([{ name, phone: phone || null }]);
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

// --- Main Component ---
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

  return (
    <AppShell>
      <PageHeader title="Wateja" description="Orodha ya wateja na mizani yao" />

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">Jumla ya wateja: {customers.length}</div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Ongeza Mteja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ongeza Mteja Mpya</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <Label htmlFor="name">Jina *</Label>
                <Input
                  id="name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Jina la mteja"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Namba ya Simu (si lazima)</Label>
                <Input
                  id="phone"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="0712345678"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={addCustomerMutation.isPending}>
                  {addCustomerMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-red-500">Imeshindwa kupakia wateja. Jaribu tena.</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Hakuna wateja bado. Ongeza mteja kwanza.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jina</TableHead>
                <TableHead>Simu</TableHead>
                <TableHead className="text-right">Mizani</TableHead>
                <TableHead className="text-right">Vitendo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleCustomerClick(customer.id)}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${customer.balance > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {formatCurrency(customer.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCustomerClick(customer.id);
                      }}
                    >
                      Tazama
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maelezo ya Mteja</DialogTitle>
          </DialogHeader>
          {selectedCustomerId && (
            <Tabs defaultValue="purchases" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="purchases">Manunuzi</TabsTrigger>
                <TabsTrigger value="payments">Malipo</TabsTrigger>
                <TabsTrigger value="record">Rekodi Malipo</TabsTrigger>
              </TabsList>
              <TabsContent value="purchases" className="space-y-4">
                {salesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                ) : sales.length === 0 ? (
                  <p className="text-muted-foreground">Hakuna manunuzi ya mkopo kwa mteja huyu.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarehe</TableHead>
                        <TableHead className="text-right">Kiasi</TableHead>
                        <TableHead>Hali</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
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
                  <p className="text-muted-foreground">Hakuna malipo yaliyorekodiwa bado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarehe</TableHead>
                        <TableHead className="text-right">Kiasi</TableHead>
                        <TableHead>Maelezo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {format(new Date(payment.payment_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(payment.amount)}
                          </TableCell>
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
                    <Label htmlFor="amount">Kiasi (TZS)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="15000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentDate">Tarehe ya Malipo</Label>
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="note">Maelezo (si lazima)</Label>
                    <Input id="note" name="note" placeholder="Malipo ya awamu ya pili" />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={recordPaymentMutation.isPending}>
                      {recordPaymentMutation.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "Rekodi Malipo"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
