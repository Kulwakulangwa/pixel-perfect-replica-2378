import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
import { Loader2, Filter, X } from "lucide-react";
import { format } from "date-fns";

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

// Fetch expenses with optional filters
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

// Add expense mutation
const addExpense = async (expense: Omit<Expense, "id" | "created_at">) => {
  const { error } = await supabase.from("expenses").insert([expense]);
  if (error) throw error;
};

const expenseCategories = [
  { value: "rent", label: "Rent" },
  { value: "electricity", label: "Electricity" },
  { value: "transport", label: "Transport" },
  { value: "salaries", label: "Salaries" },
  { value: "other", label: "Other" },
];

function ExpensesPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Form state
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState<string>("");

  // Query
  const { data: expenses = [], isLoading, error } = useQuery({
    queryKey: ["expenses", categoryFilter, fromDate, toDate],
    queryFn: () => fetchExpenses(categoryFilter, fromDate, toDate),
  });

  // Mutation
  const mutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      // Reset form
      setCategory("");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setDescription("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !amount || !expenseDate) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    mutation.mutate({
      category,
      amount: amountNum,
      expense_date: expenseDate,
      description: description || null,
    });
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
      <PageHeader title="Gharama" description="Rekodi na udhibiti gharama zako" />

      {/* Add Expense Form */}
      <div className="border rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Ongeza Gharama</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi Gharama"}
            </Button>
          </div>
        </form>
      </div>

      {/* Filters */}
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

      {/* Expenses List */}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="capitalize">{exp.category}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(exp.amount)}</TableCell>
                  <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{exp.description || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
