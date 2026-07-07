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
import { Loader2, X, Pencil, Trash2, Plus, Wallet, Receipt, TrendingUp } from "lucide-react";
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
  component: () => (
    <AppShell requireOwner>
      <ExpensesPage />
    </AppShell>
  ),
});

type Expense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  created_at: string;
};

// --- Fetch expenses ---
const fetchExpenses = async (category?: string, fromDate?: string, toDate?: string) => {
  let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false });

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

// --- Add expense ---
const addExpense = async (expense: Omit<Expense, "id" | "created_at">) => {
  const { data: shopId, error: shopError } = await supabase.rpc("current_shop_id");
  if (shopError) throw shopError;
  if (!shopId) throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Hakuna mtumiaji aliyeingia.");

  const { error } = await supabase.from("expenses").insert([
    {
      shop_id: shopId,
      recorded_by: user.id,
      category: expense.category,
      amount: expense.amount,
      expense_date: expense.expense_date,
      description: expense.description || null,
    },
  ]);
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

// --- Delete expense ---
const deleteExpense = async (id: string) => {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
};

// --- Categories ---
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

  // Add form
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Edit form
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // --- Queries ---
  const { data: expenses = [], isLoading, error } = useQuery({
    queryKey: ["expenses", categoryFilter, fromDate, toDate],
    queryFn: () => fetchExpenses(categoryFilter, fromDate, toDate),
  });

  // --- Mutations ---
  const addMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setCategory("");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setIsAddDialogOpen(false);
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

  // --- Handlers ---
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
    if (window.confirm(`Futa gharama "${description || "isiyo na jina"}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const clearFilters = () => {
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  // --- Compute summary ---
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseCount = expenses.length;
  const categorySummary = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];

  // --- Render ---
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Gharama"
        description="Rekodi, hariri na futa gharama zako"
        action={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> Ongeza Gharama
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ongeza Gharama</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <Label>Aina</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Chagua aina" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kiasi (TZS)</Label>
                  <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div>
                  <Label>Tarehe</Label>
                  <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
                </div>
                <div>
                  <Label>Maelezo</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Maelezo ya gharama" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Ghairi</Button>
                  <Button type="submit" disabled={addMutation.isPending}>
                    {addMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Jumla ya Gharama"
          value={formatCurrency(totalExpenses)}
          icon={Wallet}
          variant="rose"
        />
        <StatCard
          label="Idadi ya Gharama"
          value={String(expenseCount)}
          icon={Receipt}
          variant="mint"
        />
        <StatCard
          label="Aina Kuu"
          value={topCategory ? topCategory[0].replace("_", " ") : "—"}
          sub={topCategory ? formatCurrency(topCategory[1]) : ""}
          icon={TrendingUp}
          variant="amber"
        />
        <StatCard
          label="Wastani"
          value={expenseCount > 0 ? formatCurrency(totalExpenses / expenseCount) : "TSh 0"}
          icon={TrendingUp}
          variant="dark"
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 shadow-sm mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="categoryFilter" className="text-sm font-medium">Chuja Kwa Aina</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="mt-1">
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
            <Label htmlFor="fromDate" className="text-sm font-medium">Kuanzia</Label>
            <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="toDate" className="text-sm font-medium">Mpaka</Label>
            <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
          </div>
          <Button variant="ghost" onClick={clearFilters} className="h-10 px-3">
            <X className="h-4 w-4 mr-1" /> Futa
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-red-500">Imeshindwa kupakia gharama. Jaribu tena.</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Hakuna gharama zilizorekodiwa.</div>
      ) : (
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
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
                  <TableCell className="capitalize">{exp.category.replace("_", " ")}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(exp.amount)}</TableCell>
                  <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{exp.description || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(exp)} className="mr-2">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(exp.id, exp.description)} className="text-red-500 hover:text-red-700">
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
                  onValueChange={(val) => setEditingExpense({ ...editingExpense, category: val })}
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
    </div>
  );
}

// --- Helper Components ---

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
