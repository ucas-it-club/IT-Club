import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { BrandButton } from "./BrandButton";
import { ImageCropper } from "./ImageCropper";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/club/supabase";

export function ContentEditorImageUpload({
  ar,
  disabled = false,
  onUploaded,
  onPendingChange,
  onPreviewChange,
}: {
  ar: boolean;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onPendingChange: (pending: boolean) => void;
  onPreviewChange: (url: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      onPreviewChange("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    onPreviewChange(url);

    return () => URL.revokeObjectURL(url);
  }, [file, onPreviewChange]);

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setError("");

    try {
      const url = await uploadImage(file);
      onUploaded(url);
      setFile(null);
      onPendingChange(false);
    } catch {
      setError(
        ar
          ? "تعذر رفع الصورة. استخدم JPG أو PNG أو WebP حتى 5 ميغابايت وتحقق من إعداد التخزين."
          : "Upload failed. Use JPG, PNG or WebP up to 5 MB and check storage setup.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm">
          {ar ? "JPG / PNG / WebP، حتى 5 ميغابايت" : "JPG / PNG / WebP, up to 5 MB"}
        </span>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || uploading}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setFile(null);
            setCropSource(selected);
            onPendingChange(Boolean(selected));
            event.target.value = "";
          }}
        />
      </label>
      {cropSource && (
        <ImageCropper
          file={cropSource}
          ar={ar}
          onConfirm={(cropped) => {
            setFile(cropped);
            setCropSource(null);
          }}
          onCancel={() => {
            setCropSource(null);
            onPendingChange(false);
          }}
        />
      )}
      {preview && (
        <div className="mt-4">
          <img
            src={preview}
            alt={ar ? "معاينة قبل الرفع" : "Preview before upload"}
            className="aspect-video w-full max-w-xl rounded-xl object-cover"
          />
          <div className="mt-3 flex gap-3">
            <BrandButton
              type="button"
              disabled={disabled || uploading}
              onClick={() => void upload()}
            >
              <Upload size={16} />
              {uploading ? (ar ? "جارٍ الرفع…" : "Uploading…") : ar ? "رفع الصورة" : "Upload image"}
            </BrandButton>
            <BrandButton
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => {
                setFile(null);
                onPendingChange(false);
              }}
            >
              {ar ? "إلغاء الصورة" : "Discard image"}
            </BrandButton>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
    </>
  );
}
