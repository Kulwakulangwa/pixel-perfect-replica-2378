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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Loader2, Pencil, Trash2, Plus, Users, Phone, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers")({
  ssr: false,
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
};

// --- Stat card component (mirrors dashboard) ---
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

// --- Data fetching ---
const fetchSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data || [];
};

const addSupplier = async (name: string, phone?: string, note?: string) => {
  const { data: shopId, error: shopError } = await supabase.rpc("current_shop_id");
  if (shopError) throw shopError;
  if (!shopId) throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu.");
  const { error } = await supabase.from("suppliers").insert([
    { shop_id: shopId, name, phone: phone || null, note: note || null },
  ]);
  if (error) throw error;
};

const updateSupplier = async (id: string, name: string, phone?: string, note?: string) => {
  const { error } = await supabase
    .from("suppliers")
    .update({ name, phone: phone || null, note: note || null })
    .eq("id", id);
  if (error) throw error;
};

const deleteSupplier = async (id: string) => {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
};

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });

  const addMutation = useMutation({
    mutationFn: ({ name, phone, note }: { name: string; phone?: string; note?: string }) =>
      addSupplier(name, phone, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsAddDialogOpen(false);
      setNewName("");
      setNewPhone("");
      setNewNote("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      phone,
      note,
    }: {
      id: string;
      name: string;
      phone?: string;
      note?: string;
    }) => updateSupplier(id, name, phone, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsEditDialogOpen(false);
      setEditingSupplier(null);
      setNewName("");
      setNewPhone("");
      setNewNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addMutation.mutate({
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      note: newNote.trim() || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !newName.trim()) return;
    updateMutation.mutate({
      id: editingSupplier.id,
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      note: newNote.trim() || undefined,
    });
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewName(supplier.name);
    setNewPhone(supplier.phone || "");
    setNewNote(supplier.note || "");
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Je, una uhakika unataka kufuta muuzaji "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // --- Stats ---
  const totalSuppliers = suppliers.length;
  const withPhone = suppliers.filter((s) => s.phone).length;
  const withNote = suppliers.filter((s) => s.note).length;

  return (
    <AppShell requireOwner>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Suppliers"
          description="Manage your suppliers"
          action={
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  <Plus className="mr-2 h-4 w-4" /> Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-[#1a1a1a] dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle className="dark:text-slate-200">Add New Supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Name *</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Supplier name"
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="0712345678"
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Note (optional)</Label>
                    <Input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Address or other details"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addMutation.isPending} className="rounded-xl">
                      {addMutation.isPending ? <Loader2 className="animate-spin" /> : "Save"}
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
            label="Total Suppliers"
            value={String(totalSuppliers)}
            icon={Users}
            variant="dark"
          />
          <StatCard
            label="With Phone"
            value={String(withPhone)}
            sub={`${totalSuppliers > 0 ? Math.round((withPhone / totalSuppliers) * 100) : 0}%`}
            icon={Phone}
            variant="mint"
          />
          <StatCard
            label="With Note"
            value={String(withNote)}
            sub={`${totalSuppliers > 0 ? Math.round((withNote / totalSuppliers) * 100) : 0}%`}
            icon={FileText}
            variant="amber"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="text-red-500">Imeshindwa kupakia wauzaji. Jaribu tena.</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground dark:text-slate-400">
            No suppliers yet. Add your first supplier.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium dark:text-slate-200">{supplier.name}</TableCell>
                    <TableCell className="dark:text-slate-300">{supplier.phone || "-"}</TableCell>
                    <TableCell className="dark:text-slate-300">{supplier.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(supplier)}
                        className="mr-2"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
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
          <DialogContent className="dark:bg-[#1a1a1a] dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-200">Edit Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Name *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Supplier name"
                  className="rounded-xl"
                  required
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Phone</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0712345678"
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Note</Label>
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Address or other details"
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="rounded-xl">
                  {updateMutation.isPending ? <Loader2 className="animate-spin" /> : "Update"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
