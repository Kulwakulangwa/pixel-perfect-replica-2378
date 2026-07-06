import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
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
import { Loader2, Upload, UserPlus, Image, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

type ShopSettings = {
  id: string;
  name: string;
  logo_url: string | null;
  receipt_footer: string | null;
};

type Staff = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  can_discount: boolean;
};

// --- Fetch shop settings with fallback ---
const fetchShopSettings = async (): Promise<ShopSettings> => {
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error("Haujaingia. Tafadhali ingia tena.");
  if (!user) throw new Error("Hakuna mtumiaji aliyeingia.");

  // Get shop_id directly from staff table (more reliable than RPC)
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("shop_id")
    .eq("id", user.id)
    .single();
  
  if (staffError) {
    console.error("Staff fetch error:", staffError);
    throw new Error("Hakuna duka lililopatikana kwa mtumiaji huyu. Wasiliana na msimamizi.");
  }
  
  if (!staff?.shop_id) {
    throw new Error("Duka halijapatikana. Wasiliana na msimamizi.");
  }

  // Now fetch settings for that shop
  const { data, error } = await supabase
    .from("shops")
    .select("id, name, logo_url, receipt_footer")
    .eq('id', staff.shop_id)
    .single();
  
  if (error) throw error;
  return data;
};

const fetchCashiers = async (): Promise<Staff[]> => {
  const { data, error } = await supabase
    .from("staff")
    .select("id, email, full_name, role, can_discount")
    .eq("role", "cashier");
  if (error) throw error;
  return data;
};

const updateShopSettings = async (settings: Partial<ShopSettings>) => {
  const { id, ...update } = settings;
  const { error } = await supabase
    .from("shops")
    .update(update)
    .eq("id", id);
  if (error) throw error;
};

const updateCashierPermission = async (staffId: string, can_discount: boolean) => {
  const { error } = await supabase
    .from("staff")
    .update({ can_discount })
    .eq("id", staffId);
  if (error) throw error;
};

const deleteCashier = async (staffId: string) => {
  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("id", staffId);
  if (error) throw error;
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shopName, setShopName] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [shopId, setShopId] = useState<string>("");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCashierEmail, setNewCashierEmail] = useState("");
  const [newCashierPassword, setNewCashierPassword] = useState("");
  const [newCashierName, setNewCashierName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [addingCashier, setAddingCashier] = useState(false);

  const { data: shop, isLoading: shopLoading, error: shopError, refetch } = useQuery({
    queryKey: ["shopSettings"],
    queryFn: fetchShopSettings,
    retry: 1,
    onSuccess: (data) => {
      if (data) {
        setShopId(data.id);
        setShopName(data.name);
        setReceiptFooter(data.receipt_footer || "");
      }
    },
    onError: (err) => {
      console.error("Shop settings error:", err);
      toast.error("Imeshindwa kupakia maelezo ya duka. Tafadhali ingia tena.");
    }
  });

  const { data: cashiers = [], isLoading: cashiersLoading } = useQuery({
    queryKey: ["cashiers"],
    queryFn: fetchCashiers,
    onError: (err) => {
      toast.error("Imeshindwa kupakia orodha ya wasimamizi: " + (err as Error).message);
    }
  });

  const updateShopMutation = useMutation({
    mutationFn: updateShopSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
      toast.success("Maelezo ya duka yamehifadhiwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kuhifadhi: " + (err as Error).message);
    }
  });

  const updatePermissionMutation = useMutation({
    mutationFn: updateCashierPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      toast.success("Ruhusa imebadilishwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kubadilisha ruhusa: " + (err as Error).message);
    }
  });

  const deleteCashierMutation = useMutation({
    mutationFn: deleteCashier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      toast.success("Cashier imefutwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kufuta: " + (err as Error).message);
    }
  });

  const handleShopUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) {
      toast.error("Duka halijapatikana. Tafadhali ingia tena.");
      return;
    }
    updateShopMutation.mutate({
      id: shopId,
      name: shopName,
      receipt_footer: receiptFooter || null,
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("Chagua picha kwanza.");
      return;
    }
    
    if (!shopId) {
      toast.error("Duka halijapatikana. Tafadhali ingia tena.");
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Picha ni kubwa sana. Tafadhali chagua picha chini ya 2MB.");
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${shopId}/logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('shop-media')
        .upload(fileName, file, { 
          upsert: true,
          cacheControl: '3600',
          contentType: file.type
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-media')
        .getPublicUrl(fileName);
      
      await updateShopSettings({
        id: shopId,
        logo_url: publicUrl,
      });
      
      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
      toast.success("Logo imepakiwa!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Imeshindwa kupakia picha: " + (error as Error).message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierEmail || !newCashierPassword || !newCashierName) {
      toast.error("Tafadhali jaza sehemu zote.");
      return;
    }

    setAddingCashier(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cashier', {
        body: {
          email: newCashierEmail,
          password: newCashierPassword,
          full_name: newCashierName,
        },
      });
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["cashiers"] });
      setIsAddDialogOpen(false);
      setNewCashierEmail("");
      setNewCashierPassword("");
      setNewCashierName("");
      toast.success("Cashier imeongezwa kikamilifu!");
    } catch (error) {
      console.error("Error creating cashier:", error);
      toast.error("Imeshindwa kuunda akaunti. Jaribu tena.");
    } finally {
      setAddingCashier(false);
    }
  };

  const togglePermission = (staffId: string, current: boolean) => {
    updatePermissionMutation.mutate({ staffId, can_discount: !current });
  };

  const handleDeleteCashier = (staffId: string, name: string) => {
    if (window.confirm(`Je, una uhakika unataka kufuta cashier "${name}"?`)) {
      deleteCashierMutation.mutate(staffId);
    }
  };

  if (shopLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (shopError) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <div className="text-red-500 mb-4">Imeshindwa kupakia maelezo ya duka</div>
          <Button onClick={() => refetch()}>Jaribu tena</Button>
          <Button variant="outline" className="ml-2" onClick={() => supabase.auth.signOut()}>
            Ingia tena
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Mipangilio" description="Dhibiti mazingira ya duka lako" />

      <div className="space-y-8">
        {/* Shop Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Maelezo ya Duka</h3>
          <form onSubmit={handleShopUpdate} className="space-y-4">
            <div>
              <Label htmlFor="shopName">Jina la Duka</Label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Jina la duka lako"
                required
              />
            </div>
            <div>
              <Label htmlFor="receiptFooter">Kisaini cha Risiti (footer)</Label>
              <textarea
                id="receiptFooter"
                className="w-full min-h-[80px] p-2 border rounded-md"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Asante kwa kununua! ..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Maudhui haya yataonekana chini ya kila risiti.</p>
            </div>
            <Button type="submit" disabled={updateShopMutation.isPending}>
              {updateShopMutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi Mabadiliko"}
            </Button>
          </form>
        </div>

        {/* Logo Upload */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Picha ya Duka (Logo)</h3>
          <div className="flex items-center gap-4">
            {shop?.logo_url ? (
              <div className="relative">
                <img
                  src={shop.logo_url}
                  alt="Logo"
                  className="w-20 h-20 object-contain border rounded"
                  onError={(e) => (e.currentTarget.src = '')}
                />
              </div>
            ) : (
              <div className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                <Image className="h-8 w-8" />
              </div>
            )}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadingLogo ? "Inapakia..." : "Pakia Logo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Saizi inayopendekezwa: 200x200px, max 2MB</p>
            </div>
          </div>
        </div>

        {/* Cashier Management */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Wasimamizi (Cashiers)</h3>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                <form onSubmit={handleAddCashier} className="space-y-4">
                  <div>
                    <Label htmlFor="cashierName">Jina Kamili</Label>
                    <Input
                      id="cashierName"
                      value={newCashierName}
                      onChange={(e) => setNewCashierName(e.target.value)}
                      placeholder="Jina la cashier"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cashierEmail">Barua Pepe</Label>
                    <Input
                      id="cashierEmail"
                      type="email"
                      value={newCashierEmail}
                      onChange={(e) => setNewCashierEmail(e.target.value)}
                      placeholder="cashier@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cashierPassword">Nenosiri</Label>
                    <Input
                      id="cashierPassword"
                      type="password"
                      value={newCashierPassword}
                      onChange={(e) => setNewCashierPassword(e.target.value)}
                      placeholder="Nenosiri la ingia"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={addingCashier}>
                      {addingCashier ? <Loader2 className="animate-spin mr-2" /> : null}
                      {addingCashier ? "Inaongezwa..." : "Hifadhi"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cashiersLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
                        onCheckedChange={() => togglePermission(cashier.id, cashier.can_discount)}
                        disabled={updatePermissionMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCashier(cashier.id, cashier.full_name || cashier.email)}
                        className="text-red-500 hover:text-red-700"
                        disabled={deleteCashierMutation.isPending}
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
      </div>
    </AppShell>
  );
}
