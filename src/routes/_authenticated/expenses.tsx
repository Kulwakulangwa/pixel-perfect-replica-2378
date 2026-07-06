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
import { AppShell, PageHeader } from "@/components/app-shell";
import { Loader2, X, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/expenses")({
  ssr: false,
  component: ExpensesPage,
});

type Expense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  created_at: string;
};

// --- Fetch expenses (no change) ---
const fetchExpenses = async (category?: string, fromDate?: string, toDate?: string) => {
  let query = supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (fromDate) {
    query = query.gte("expense_date", fromDate);
  }
  if (toDate) {
    query = query.lte("expense_date", toDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
};

// --- Add expense (with shop_id and recorded_by) ---
const addExpense = async (expense: Omit<Expense, "id" | "created_at">) => {
  const { data: shopId, error: shopError } = await supabase.rpc('current_shop_id');
  if (shopError) throw shopError;
  if (!shopId) throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Hakuna mtumiaji aliyeingia.");

  const { error } = await supabase
    .from("expenses")
    .insert([{
      shop_id: shopId,
      recorded_by: user.id,
      category: expense.category,
      amount: expense.amount,
      expense_date: expense.expense_date,
      description: expense.description || null,
    }]);
  if (error) throw error;
};

// --- Update expense ---
const updateExpense = async (id: string, updates: Partial<Expense>) => {
  const { error } = await supabase
    .from("expenses")
    .update({
      category: updates.category,
      amount: updates.amount,
      expense_date: updates.expense_date,
      description: updates.description || null,
    })
    .eq("id", id);
  if (error) throw error;
};

// --- Delete expense (hard delete) ---
const deleteExpense = async (id: string) => {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
};

// --- Categories list ---
const expenseCategories = [
  { value: "rent", label: "Rent" },
  { value: "electricity", label: "Electricity" },
  { value: "transport", label: "Transport" },
  { value: "salaries", label: "Salaries" },
  { value: "stock_purchase", label: "Stock Purchase" },
  { value: "other", label: "Other" },
];

function ExpensesPage() {
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // For adding
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState<string>("");

  // For editing
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: expenses = [], isLoading, error } = useQuery({
    queryKey: ["expenses", categoryFilter, fromDate, toDate],
    queryFn: () => fetchExpenses(categoryFilter, fromDate, toDate),
  });

  const addMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setCategory("");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setDescription("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Expense> }) =>
      updateExpense(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsEditDialogOpen(false);
      setEditingExpense(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !amount || !expenseDate) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    addMutation.mutate({
      category,
      amount: amountNum,
      expense_date: expenseDate,
      description: description || null,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const amountNum = parseFloat(String(editingExpense.amount));
    if (isNaN(amountNum) || amountNum <= 0) return;
    updateMutation.mutate({
      id: editingExpense.id,
      updates: {
        category: editingExpense.category,
        amount: amountNum,
        expense_date: editingExpense.expense_date,
        description: editingExpense.description || null,
      },
    });
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string, description: string | null) => {
    if (window.confirm(`Futa gharama "${description || 'isiyo na jina'}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  const clearFilters = () => {
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <AppShell>
      <PageHeader title="Gharama" description="Rekodi, hariri na futa gharama zako" />

      {/* Add Form (same as before) */}
      <div className="border rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Ongeza Gharama</h3>
        <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="category">Aina</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Chagua aina" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Kiasi (TZS)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="15000"
              required
            />
          </div>
          <div>
            <Label htmlFor="expenseDate">Tarehe</Label>
            <Input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Maelezo</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Maelezo ya gharama"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi Gharama"}
            </Button>
          </div>
        </form>
      </div>

      {/* Filters (unchanged) */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="categoryFilter">Chuja Kwa Aina</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Aina zote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Zote</SelectItem>
              {expenseCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
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
        <Button variant="ghost" onClick={clearFilters} className="h-10 px-3">
          <X className="h-4 w-4 mr-1" /> Futa
        </Button>
      </div>

      {/* Table with Edit & Delete buttons */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-red-500">Imeshindwa kupakia gharama. Jaribu tena.</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Hakuna gharama zilizorekodiwa.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aina</TableHead>
                <TableHead className="text-right">Kiasi</TableHead>
                <TableHead>Tarehe</TableHead>
                <TableHead>Maelezo</TableHead>
                <TableHead className="text-right">Vitendo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="capitalize">{exp.category}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(exp.amount)}</TableCell>
                  <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{exp.description || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(exp)}
                      className="mr-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(exp.id, exp.description)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {editingExpense && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hariri Gharama</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label>Aina</Label>
                <Select
                  value={editingExpense.category}
                  onValueChange={(val) =>
                    setEditingExpense({ ...editingExpense, category: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kiasi (TZS)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editingExpense.amount}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Tarehe</Label>
                <Input
                  type="date"
                  value={editingExpense.expense_date}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      expense_date: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Maelezo</Label>
                <Input
                  value={editingExpense.description || ""}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      description: e.target.value || null,
                    })
                  }
                  placeholder="Maelezo ya gharama"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Ghairi
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </AppShell>
  );
}
