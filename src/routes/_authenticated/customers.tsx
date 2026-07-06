import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Loader2, UserPlus, Eye } from "lucide-react";

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

// --- Queries ---
const fetchCustomers = async (): Promise<CustomerBalance[]> => {
  const { data, error } = await supabase
    .from("v_customer_balances")
    .select("*");
  if (error) throw error;
  return data || [];
};

// --- Mutations ---
const addCustomer = async (name: string, phone?: string) => {
  const { error } = await supabase
    .from("customers")
    .insert([{ name, phone: phone || null }]);
  if (error) throw error;
};

// --- Main Component ---
function CustomersPage() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const addCustomerMutation = useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) =>
      addCustomer(name, phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setAddDialogOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    },
  });

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    addCustomerMutation.mutate({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() || undefined });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  return (
    <AppShell>
      <PageHeader title="Wateja" description="Orodha ya wateja na mizani yao" />

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          Jumla ya wateja: {customers.length}
        </div>
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
        <div className="text-center py-8 text-muted-foreground">Hakuna wateja bado. Ongeza mteja kwanza.</div>
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
                  onClick={() => window.location.href = `/customers/${customer.id}`}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell className={`text-right font-semibold ${customer.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(customer.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/customers/$id" params={{ id: customer.id }}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" /> Tazama
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
