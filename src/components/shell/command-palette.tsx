"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CornerDownLeft,
  FileText,
  Loader2,
  Search,
  Target,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  type: "person" | "goal" | "cycle";
  title: string;
  subtitle: string | null;
  href: string;
  avatarUrl?: string | null;
};

const ICONS = {
  person: User,
  goal: Target,
  cycle: FileText,
} as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { results: Result[] };
          setResults(data.results);
          setActive(0);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  const go = (r: Result) => {
    onOpenChange(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-2xl animate-rise">
          <DialogPrimitive.Title className="sr-only">Search Meridian</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" />
            ) : (
              <Search className="size-4 shrink-0 text-ink-3" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search people, goals, cycles…"
              className="h-13 w-full bg-transparent text-[0.875rem] text-ink-1 outline-none placeholder:text-ink-4"
              aria-label="Search"
            />
            <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-4 sm:block">
              ESC
            </kbd>
          </div>

          <div className="max-h-[52vh] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <div className="px-3 py-6">
                <p className="eyebrow mb-2">Try</p>
                <ul className="space-y-1 text-[0.8125rem] text-ink-3">
                  {["Quarterly goals", "Priya Sharma", "Q1 2026 review", "At-risk objectives"].map(
                    (s) => (
                      <li key={s}>
                        <button
                          onClick={() => setQuery(s)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-3 hover:text-ink-1"
                        >
                          <Search className="size-3.5 text-ink-4" /> {s}
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : results.length === 0 && !loading ? (
              <p className="px-3 py-10 text-center text-[0.8125rem] text-ink-3">
                No matches for “{query}”.
              </p>
            ) : (
              <ul role="listbox" aria-label="Search results">
                {results.map((r, i) => {
                  const Icon = ICONS[r.type];
                  return (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                          i === active ? "bg-surface-3" : "hover:bg-surface-2",
                        )}
                      >
                        {r.type === "person" ? (
                          <Avatar name={r.title} src={r.avatarUrl} size={28} />
                        ) : (
                          <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3">
                            <Icon className="size-3.5" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-ink-1">
                            {r.title}
                          </span>
                          {r.subtitle ? (
                            <span className="block truncate text-[0.6875rem] text-ink-3">
                              {r.subtitle}
                            </span>
                          ) : null}
                        </span>
                        {i === active ? (
                          <CornerDownLeft className="size-3.5 shrink-0 text-ink-4" />
                        ) : (
                          <ArrowRight className="size-3.5 shrink-0 text-transparent" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
