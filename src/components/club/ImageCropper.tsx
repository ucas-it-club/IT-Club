import { useEffect, useRef, useState } from "react";
import { Crop, Move } from "lucide-react";
import { BrandButton } from "./BrandButton";
import { Slider } from "@/components/ui/slider";

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;

type Position = { x: number; y: number };

function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  position: Position,
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const scale =
    Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
  const visibleWidth = canvas.width / scale;
  const visibleHeight = canvas.height / scale;
  const sourceX = ((image.naturalWidth - visibleWidth) * (position.x + 1)) / 2;
  const sourceY = ((image.naturalHeight - visibleHeight) * (position.y + 1)) / 2;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    Math.max(0, sourceX),
    Math.max(0, sourceY),
    Math.min(image.naturalWidth, visibleWidth),
    Math.min(image.naturalHeight, visibleHeight),
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

export function ImageCropper({
  file,
  ar,
  onConfirm,
  onCancel,
}: {
  file: File;
  ar: boolean;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardPreviewRef = useRef<HTMLCanvasElement>(null);
  const detailPreviewRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; position: Position } | null>(null);
  const [source, setSource] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
    };
    image.src = source;
  }, [source]);

  useEffect(() => {
    if (canvasRef.current && imageRef.current) {
      drawCrop(canvasRef.current, imageRef.current, zoom, position);
      if (cardPreviewRef.current)
        drawCrop(cardPreviewRef.current, imageRef.current, zoom, position);
      if (detailPreviewRef.current)
        drawCrop(detailPreviewRef.current, imageRef.current, zoom, position);
    }
  }, [ready, zoom, position]);

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const sensitivity = 2.4 / Math.min(bounds.width, bounds.height);
    setPosition({
      x: Math.max(
        -1,
        Math.min(1, dragRef.current.position.x - (event.clientX - dragRef.current.x) * sensitivity),
      ),
      y: Math.max(
        -1,
        Math.min(1, dragRef.current.position.y - (event.clientY - dragRef.current.y) * sensitivity),
      ),
    });
  }

  async function confirm() {
    if (!imageRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    drawCrop(canvas, imageRef.current, zoom, position);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.88),
    );
    if (blob)
      onConfirm(
        new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.webp`, {
          type: "image/webp",
        }),
      );
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-primary/25 bg-muted/30 p-4"
      aria-label={ar ? "قص الصورة" : "Crop image"}
    >
      <div className="mb-3 flex items-center gap-2 font-bold">
        <Crop size={18} />
        {ar ? "قص صورة الغلاف" : "Crop cover image"}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {ar
          ? "اسحبي الصورة لتحديد موضعها، ثم كبّريها عند الحاجة. سيتم حفظ الجزء الظاهر فقط بنسبة 16:9."
          : "Drag to position the image, then zoom if needed. Only the visible 16:9 area will be saved."}
      </p>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="aspect-video w-full touch-none cursor-grab rounded-xl bg-black object-cover active:cursor-grabbing"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, position };
        }}
        onPointerMove={move}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      />
      <label className="mt-4 grid gap-2 text-sm font-bold">
        <span className="flex items-center gap-2">
          <Move size={16} />
          {ar ? "التكبير" : "Zoom"} · {Math.round(zoom * 100)}%
        </span>
        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.01}
          onValueChange={([value]) => setZoom(value ?? 1)}
        />
      </label>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <figure>
          <figcaption className="mb-2 text-sm font-bold">
            {ar ? "في صفحة كل الفعاليات" : "All events page"} · 16:9
          </figcaption>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <canvas width={640} height={360} ref={cardPreviewRef} className="aspect-video w-full" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-2/3 rounded bg-foreground/15" />
              <div className="h-2 w-full rounded bg-foreground/10" />
            </div>
          </div>
        </figure>
        <figure>
          <figcaption className="mb-2 text-sm font-bold">
            {ar ? "في صفحة الفعالية" : "Event detail page"} · 16:9
          </figcaption>
          <canvas
            width={640}
            height={360}
            ref={detailPreviewRef}
            className="aspect-video w-full rounded-2xl border"
          />
        </figure>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <BrandButton type="button" disabled={!ready} onClick={() => void confirm()}>
          {ar ? "اعتماد القص" : "Apply crop"}
        </BrandButton>
        <BrandButton type="button" variant="ghost" onClick={onCancel}>
          {ar ? "إلغاء" : "Cancel"}
        </BrandButton>
      </div>
    </section>
  );
}
