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
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";

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

// Fetch all suppliers for the current shop
const fetchSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data || [];
};

// Add supplier with current shop_id
const addSupplier = async (name: string, phone?: string, note?: string) => {
  // Get current shop_id
  const { data: shopId, error: shopError } = await supabase.rpc("current_shop_id");
  if (shopError) throw shopError;
  if (!shopId) throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu.");

  const { error } = await supabase.from("suppliers").insert([
    {
      shop_id: shopId,
      name,
      phone: phone || null,
      note: note || null,
    },
  ]);
  if (error) throw error;
};

// Update supplier
const updateSupplier = async (id: string, name: string, phone?: string, note?: string) => {
  const { error } = await supabase
    .from("suppliers")
    .update({ name, phone: phone || null, note: note || null })
    .eq("id", id);
  if (error) throw error;
};

// Delete supplier
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

  const {
    data: suppliers = [],
    isLoading,
    error,
  } = useQuery({
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

  return (
    <AppShell requireOwner>
      <PageHeader title="Wauzaji" description="Udhibiti wa wauzaji na wasambazaji wa bidhaa zako" />

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">Jumla ya wauzaji: {suppliers.length}</div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ongeza Muuzaji
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ongeza Muuzaji Mpya</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Jina *</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jina la muuzaji"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Namba ya Simu</Label>
                <Input
                  id="phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0712345678"
                />
              </div>
              <div>
                <Label htmlFor="note">Maelezo (hiari)</Label>
                <Input
                  id="note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Anuani au maelezo mengine"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi"}
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
        <div className="text-red-500">Imeshindwa kupakia wauzaji. Jaribu tena.</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Hakuna wauzaji bado. Ongeza muuzaji kwanza.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jina</TableHead>
                <TableHead>Simu</TableHead>
                <TableHead>Maelezo</TableHead>
                <TableHead className="text-right">Vitendo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.phone || "-"}</TableCell>
                  <TableCell>{supplier.note || "-"}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hariri Muuzaji</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Jina *</Label>
              <Input
                id="edit-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jina la muuzaji"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Namba ya Simu</Label>
              <Input
                id="edit-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="0712345678"
              />
            </div>
            <div>
              <Label htmlFor="edit-note">Maelezo (hiari)</Label>
              <Input
                id="edit-note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Anuani au maelezo mengine"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
