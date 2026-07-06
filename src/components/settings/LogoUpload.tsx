import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Image, Loader2, Upload } from "lucide-react";

type LogoUploadProps = {
  shopId: string;
  currentLogoUrl: string | null;
};

export function LogoUpload({ shopId, currentLogoUrl }: LogoUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("Chagua picha kwanza.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Picha ni kubwa sana. Tafadhali chagua picha chini ya 2MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${shopId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("shop-media")
        .upload(fileName, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("shop-media").getPublicUrl(fileName);

      await supabase.from("shops").update({ logo_url: publicUrl }).eq("id", shopId);

      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
      toast.success("Logo imepakiwa!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Imeshindwa kupakia picha: " + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Picha ya Duka (Logo)</h3>
      <div className="flex items-center gap-4">
        {currentLogoUrl ? (
          <img
            src={currentLogoUrl}
            alt="Logo"
            className="w-20 h-20 object-contain border rounded"
            onError={(e) => (e.currentTarget.src = "")}
          />
        ) : (
          <div className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            <Image className="h-8 w-8" />
          </div>
        )}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? "Inapakia..." : "Pakia Logo"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Saizi inayopendekezwa: 200x200px, max 2MB
          </p>
        </div>
      </div>
    </div>
  );
}
