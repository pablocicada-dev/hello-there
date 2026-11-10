import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RangeKey, RangeSpec } from "@/hooks/use-deltagate";
import { fmtDateTime } from "@/lib/format";

function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function RangeSelector({
  value,
  onChange,
  allowCustom = true,
}: {
  value: RangeSpec;
  onChange: (r: RangeSpec) => void;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const keys: { k: RangeKey; label: string }[] = [
    { k: "24h", label: "24 h" },
    { k: "7d", label: "7 days" },
    { k: "30d", label: "30 days" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value.key === "custom" ? "" : value.key}
        onValueChange={(v) => v && onChange({ key: v as RangeKey })}
        className="bg-card"
      >
        {keys.map(({ k, label }) => (
          <ToggleGroupItem key={k} value={k} className="px-3 text-xs">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {allowCustom && (
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) {
              const now = Date.now();
              setFrom(toLocalInput(value.from ?? now - 3 * 864e5));
              setTo(toLocalInput(value.to ?? now));
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant={value.key === "custom" ? "default" : "outline"} size="sm" className="text-xs">
              <CalendarRange />
              {value.key === "custom" && value.from && value.to
                ? `${fmtDateTime(value.from)} – ${fmtDateTime(value.to)}`
                : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rf">From</Label>
              <Input id="rf" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt">To</Label>
              <Input id="rt" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!from || !to || Date.parse(from) >= Date.parse(to)}
              onClick={() => {
                onChange({ key: "custom", from: Date.parse(from), to: Date.parse(to) });
                setOpen(false);
              }}
            >
              Apply range
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
