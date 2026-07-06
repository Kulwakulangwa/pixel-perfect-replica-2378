import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type ShopInfoProps = {
  shopId: string;
  initialName: string;
  initialFooter: string;
};

export function ShopInfo({ shopId, initialName, initialFooter }: ShopInfoProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [footer, setFooter] = useState(initialFooter);

  useEffect(() => {
    setName(initialName);
    setFooter(initialFooter);
  }, [initialName, initialFooter]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shops")
        .update({
          name: name.trim(),
          receipt_footer: footer.trim() || null,
        })
        .eq("id", shopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
      toast.success("Maelezo ya duka yamehifadhiwa!");
    },
    onError: (err) => {
      toast.error("Imeshindwa kuhifadhi: " + (err as Error).message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Jina la duka ni lazima.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Maelezo ya Duka</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="shopName">Jina la Duka</Label>
          <Input
            id="shopName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jina la duka lako"
            required
          />
        </div>
        <div>
          <Label htmlFor="receiptFooter">Kisaini cha Risiti (footer)</Label>
          <textarea
            id="receiptFooter"
            className="w-full min-h-[80px] p-2 border rounded-md"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Asante kwa kununua! ..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maudhui haya yataonekana chini ya kila risiti.
          </p>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : "Hifadhi Mabadiliko"}
        </Button>
      </form>
    </div>
  );
}
