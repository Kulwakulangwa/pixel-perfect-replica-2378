import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, UserPlus, Trash2 } from "lucide-react";

type Staff = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  can_discount: boolean;
};

export function CashierList() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: cashiers = [], isLoading } = useQuery({
    queryKey: ["cashiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, email, full_name, role, can_discount")
        .eq("role", "cashier");
      if (error) throw error;
      return data as Staff[];
    },
    onError: (err) => {
      toast.error("Imeshindwa kupakia orodha ya wasimamizi: " + (err as Error).message);
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ id, can_discount }: { id: string; can_discount: boolean }) => {
      const { error } = await supabase.from("staff").update({ can_discount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      toast.success("Ruhusa imebadilishwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kubadilisha ruhusa: " + (err as Error).message);
    },
  });

  const deleteCashier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      toast.success("Cashier imefutwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kufuta: " + (err as Error).message);
    },
  });

  const addCashier = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-cashier", {
        body: { email, password, full_name: name },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      setOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      toast.success("Cashier imeongezwa kikamilifu!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kuunda akaunti: " + (err as Error).message);
    },
    onSettled: () => setAdding(false),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error("Tafadhali jaza sehemu zote.");
      return;
    }
    setAdding(true);
    addCashier.mutate();
  };

  const handleDelete = (id: string, fullName: string | null) => {
    if (window.confirm(`Je, una uhakika unataka kufuta cashier "${fullName || email}"?`)) {
      deleteCashier.mutate(id);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Wasimamizi (Cashiers)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Ongeza Cashier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ongeza Cashier Mpya</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="cashierName">Jina Kamili</Label>
                <Input
                  id="cashierName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jina la cashier"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cashierEmail">Barua Pepe</Label>
                <Input
                  id="cashierEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cashier@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cashierPassword">Nenosiri</Label>
                <Input
                  id="cashierPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nenosiri la ingia"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={adding}>
                  {adding ? <Loader2 className="animate-spin mr-2" /> : null}
                  {adding ? "Inaongezwa..." : "Hifadhi"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : cashiers.length === 0 ? (
        <div className="text-muted-foreground text-center py-4">Hakuna wasimamizi bado.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jina</TableHead>
              <TableHead>Barua Pepe</TableHead>
              <TableHead>Ruhusa ya Punguzo</TableHead>
              <TableHead className="text-right">Vitendo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashiers.map((cashier) => (
              <TableRow key={cashier.id}>
                <TableCell>{cashier.full_name || cashier.email}</TableCell>
                <TableCell>{cashier.email}</TableCell>
                <TableCell>
                  <Switch
                    checked={cashier.can_discount}
                    onCheckedChange={() =>
                      updatePermission.mutate({
                        id: cashier.id,
                        can_discount: !cashier.can_discount,
                      })
                    }
                    disabled={updatePermission.isPending}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(cashier.id, cashier.full_name)}
                    className="text-red-500 hover:text-red-700"
                    disabled={deleteCashier.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
