import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "./club-context";
import {
  configured,
  loadMedia,
  uploadImage,
  renameMedia,
  deleteMedia,
  type MediaAsset,
} from "@/lib/club/supabase";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import emptyMediaIllustration from "@/assets/empty-media-library.png";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const mediaKey = ["club-media"];

const noAssets: MediaAsset[] = [];

export function MediaLibrary({ onSelect }: { onSelect?: (url: string) => void }) {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    const onChanged = () => void queryClient.invalidateQueries({ queryKey: mediaKey });
    window.addEventListener("club-data-changed", onChanged);

    return () => window.removeEventListener("club-data-changed", onChanged);
  }, [queryClient]);

  const query = useQuery({
    queryKey: mediaKey,
    queryFn: loadMedia,
    enabled: configured,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const assets = query.data ?? noAssets;
  const loading = configured && query.isLoading;

  const loadError =
    query.isError &&
    (ar
      ? "تعذر تحميل مكتبة الصور. تحقق من تفعيل قاعدة البيانات والتخزين."
      : "Could not load media. Check database and storage setup.");

  const [uploadError, setUploadError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");

      return;
    }

    const value = URL.createObjectURL(file);
    setPreview(value);

    return () => URL.revokeObjectURL(value);
  }, [file]);

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setUploadError("");

    try {
      await uploadImage(file);
      setFile(null);
    } catch {
      setUploadError(
        ar
          ? "تعذر رفع الصورة. استخدم JPG أو PNG أو WebP حتى 5 ميغابايت."
          : "Upload failed. Use JPG, PNG or WebP up to 5 MB.",
      );
    } finally {
      setBusy(false);
    }
  }

  const titleById = useMemo(() => {
    const map = new Map<string, { title: string; title_en: string }>();

    for (const item of Object.values(data).flat()) map.set(item.id, item);

    return map;
  }, [data]);

  const visibleAssets = useMemo(
    () =>
      assets
        .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
        .map((asset) => ({
          asset,
          usage: asset.usedBy.map((id) => {
            const item = titleById.get(id);

            return item ? (ar ? item.title : item.title_en) : id;
          }),
        })),
    [assets, search, titleById, ar],
  );

  return (
    <section className="mt-6 space-y-6">
      <div>
        <h2 className="text-2xl font-black">{ar ? "مكتبة الصور" : "Media library"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {assets.length} {ar ? "صورة" : "images"} ·{" "}
          {(assets.reduce((total, a) => total + a.size, 0) / 1048576).toFixed(1)} MB
        </p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-6">
        <label className="block font-bold">
          {ar ? "إضافة صورة إلى المكتبة" : "Add an image to the library"}
          <Input
            className="mt-3"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        {preview && (
          <div className="mt-5">
            <img
              src={preview}
              alt={ar ? "معاينة الصورة" : "Image preview"}
              className="max-h-52 object-contain"
            />
            <div className="mt-4 flex gap-3">
              <BrandButton type="button" disabled={busy} onClick={() => void upload()}>
                {busy ? (ar ? "جارٍ الرفع…" : "Uploading…") : ar ? "رفع الصورة" : "Upload image"}
              </BrandButton>
              <BrandButton
                type="button"
                disabled={busy}
                variant="ghost"
                onClick={() => setFile(null)}
              >
                {ar ? "إلغاء" : "Cancel"}
              </BrandButton>
            </div>
          </div>
        )}
      </div>
      <Input
        aria-label={ar ? "البحث في الصور" : "Search images"}
        placeholder={ar ? "ابحث باسم الصورة…" : "Search by image name…"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {(uploadError || loadError) && (
        <p role="alert" className="rounded-xl bg-brand-gradient-soft p-4">
          {uploadError || loadError}
        </p>
      )}
      {loading ? (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      ) : !loadError && !assets.length ? (
        <div className="flex justify-center py-6">
          <img
            src={emptyMediaIllustration}
            alt={ar ? "مكتبة الصور فارغة" : "The media library is empty"}
            width={320}
            height={320}
            className="h-72 w-72 max-w-full object-contain sm:h-80 sm:w-80"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleAssets.map(({ asset, usage }) => (
            <AssetCard key={asset.id} asset={asset} onSelect={onSelect} usage={usage} />
          ))}
        </div>
      )}
    </section>
  );
}

function AssetCard({
  asset,
  onSelect,
  usage,
}: {
  asset: MediaAsset;
  onSelect: ((url: string) => void) | undefined;
  usage: string[];
}) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const [name, setName] = useState(asset.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSelected, setJustSelected] = useState(false);
  useEffect(() => {
    if (!justSelected) return;
    const timer = window.setTimeout(() => setJustSelected(false), 1500);

    return () => window.clearTimeout(timer);
  }, [justSelected]);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");

    try {
      await work();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message.includes("Image is used by published content")
          ? ar
            ? "الصورة مستخدمة في محتوى منشور. أزلها من ذلك المحتوى أولًا ثم أعد المحاولة."
            : "This image is used by published content. Remove it there first, then retry."
          : ar
            ? `تعذر إتمام العملية${message ? `: ${message}` : "."}`
            : `Could not complete the action${message ? `: ${message}` : "."}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <img
        src={asset.url}
        alt={asset.name}
        loading="lazy"
        width={320}
        height={240}
        className="h-40 w-full rounded-xl object-contain"
      />
      <label className="mt-4 block text-sm font-bold">
        {ar ? "اسم الصورة" : "Image name"}
        <Input
          className="mt-2"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">{(asset.size / 1024).toFixed(0)} KB</p>
      {usage.length > 0 ? (
        <div className="mt-3 text-sm">
          <strong>{ar ? "مستخدمة في:" : "Used in:"}</strong>
          <ul className="mt-1 list-inside list-disc">
            {usage.map((label, i) => (
              <li key={i}>{label}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            {ar
              ? "للحذف النهائي، أزل الصورة من المحتوى المذكور أعلاه واحفظ التغيير أولًا."
              : "To delete it permanently, remove it from the content above and save first."}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {ar ? "غير مستخدمة في محتوى منشور" : "Not used in published content"}
        </p>
      )}
      {asset.deleting && (
        <p className="mt-3 text-sm">
          {ar
            ? "الحذف لم يكتمل. أعيدي محاولة الحذف."
            : "Deletion is pending. Retry deletion to finish."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <BrandButton
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !name.trim() || asset.deleting}
          onClick={() => void action(() => renameMedia(asset.id, name))}
        >
          {ar ? "حفظ الاسم" : "Save name"}
        </BrandButton>
        {onSelect && (
          <BrandButton
            type="button"
            size="sm"
            disabled={busy || asset.deleting}
            onClick={() => {
              onSelect(asset.url);
              setJustSelected(true);
            }}
          >
            {justSelected ? (ar ? "✓ تمت الإضافة" : "✓ Added") : ar ? "اختيار" : "Select"}
          </BrandButton>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <BrandButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || usage.length > 0}
            >
              {ar ? "حذف نهائي" : "Delete permanently"}
            </BrandButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ar ? "حذف الصورة من التخزين؟" : "Delete image from storage?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {ar
                  ? "سيُحذف الملف نهائيًا. يسمح الحذف فقط إذا لم تستخدمه أي صفحة منشورة."
                  : "The file will be permanently deleted. Only images unused by published content can be deleted."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void action(() => deleteMedia(asset.id))}>
                {ar ? "حذف" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </article>
  );
}
