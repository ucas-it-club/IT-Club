import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { otherDialCodes, suggestedDialCodes } from "@/lib/club/dial-codes";
import { cn } from "@/lib/utils";

type Row = readonly [code: string, ar: string, en: string];

/**
 * Country-code picker: Palestine, Israel, Egypt on top, then A-Z. Typing a letter on the closed
 * button opens the list already filtered ("p" shows Pakistan, Palestine, Peru…). Matches the start
 * of any word in the name, or the code.
 */
export function DialCodeSelect({
  value,
  onChange,
  ar,
}: {
  value: string;
  onChange: (code: string) => void;
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const name = (r: Row) => (ar ? r[1] : r[2]);
  const sorted = useMemo(
    () => [...otherDialCodes].sort((a, b) => name(a).localeCompare(name(b), ar ? "ar" : "en")),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name only reads `ar`
    [ar],
  );
  const searching = search.trim() !== "";

  const item = (r: Row) => (
    <CommandItem
      key={r[0] + r[2]}
      value={`${r[2]} ${r[1]} ${r[0]}`}
      onSelect={() => {
        onChange(r[0]);
        setOpen(false);
      }}
    >
      <Check className={cn("size-4", value === r[0] ? "opacity-100" : "opacity-0")} aria-hidden />
      <span className="flex-1 truncate">{name(r)}</span>
      <bdi dir="ltr" className="opacity-70">
        {r[0]}
      </bdi>
    </CommandItem>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ar ? "رمز الدولة" : "Country code"}
          onKeyDown={(e) => {
            if (e.key.length === 1 && /[\p{L}\d+]/u.test(e.key) && !e.ctrlKey && !e.metaKey) {
              setSearch(e.key);
              setOpen(true);
              e.preventDefault();
            }
          }}
          className="flex h-10 w-28 shrink-0 items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <bdi dir="ltr">{value}</bdi>
          <ChevronDown className="size-4 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" dir={ar ? "rtl" : "ltr"}>
        <Command
          filter={(v, s) =>
            v
              .toLowerCase()
              .split(/[\s/]+/)
              .some((w) => w.startsWith(s.toLowerCase().replace(/^\+/, "")) || w === `+${s}`)
              ? 1
              : 0
          }
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={ar ? "ابحث عن دولة…" : "Search country…"}
          />
          <CommandList className="max-h-64 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CommandEmpty>{ar ? "لا نتائج" : "No results"}</CommandEmpty>
            {searching ? (
              <CommandGroup>{[...suggestedDialCodes, ...sorted].map(item)}</CommandGroup>
            ) : (
              <>
                <CommandGroup heading={ar ? "مقترحة" : "Suggested"}>
                  {suggestedDialCodes.map(item)}
                </CommandGroup>
                <CommandGroup heading={ar ? "كل الدول" : "All countries"}>
                  {sorted.map(item)}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
