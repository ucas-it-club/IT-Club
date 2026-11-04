import { cn } from "@/lib/utils";
import { richTextHtml } from "@/lib/club/rich-text";

export function RichText({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={cn(
        "club-rich-text break-words whitespace-normal [&_a]:font-bold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-s-4 [&_blockquote]:border-primary/30 [&_blockquote]:ps-4 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-black [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:ps-7 [&_p]:my-3 [&_strong]:font-black [&_ul]:my-4 [&_ul]:list-disc [&_ul]:ps-7",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: richTextHtml(value) }}
    />
  );
}
