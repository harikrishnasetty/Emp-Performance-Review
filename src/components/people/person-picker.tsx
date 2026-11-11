"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type PersonOption = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
};

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  avatarUrl?: string | null;
};

export function PersonPicker({
  value,
  onChange,
  excludeIds = [],
  suggestions = [],
  placeholder = "Search people by name",
  ariaLabel = "Choose a person",
}: {
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
  excludeIds?: string[];
  suggestions?: PersonOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PersonOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
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
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(
            data.results
              .filter((r) => r.type === "person" && !excludeIds.includes(r.id))
              .map((r) => ({
                id: r.id,
                name: r.title,
                jobTitle: r.subtitle,
                avatarUrl: r.avatarUrl ?? null,
              })),
          );
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, excludeIds]);

  const visible =
    query.trim().length >= 2
      ? results
      : suggestions.filter((s) => !excludeIds.includes(s.id)).slice(0, 6);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-9.5 items-center rounded-[0.6rem] border border-line bg-surface-0 transition-colors focus-within:border-brand-400/60 focus-within:ring-2 focus-within:ring-brand-500/20",
        )}
      >
        {value ? (
          <div className="flex w-full items-center gap-2 px-2.5 py-1.5">
            <Avatar name={value.name} src={value.avatarUrl} size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] text-ink-1">{value.name}</p>
              {value.jobTitle ? (
                <p className="truncate text-[0.625rem] text-ink-4">{value.jobTitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQuery("");
              }}
              className="rounded p-1 text-ink-4 hover:bg-surface-3 hover:text-ink-1"
              aria-label="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            {loading ? (
              <Loader2 className="ml-3 size-3.5 shrink-0 animate-spin text-ink-4" />
            ) : (
              <Search className="ml-3 size-3.5 shrink-0 text-ink-4" />
            )}
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="h-9.5 w-full bg-transparent px-2.5 text-sm text-ink-1 outline-none placeholder:text-ink-4"
            />
          </>
        )}
      </div>

      {open && !value && visible.length > 0 ? (
        <ul
          className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-2xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {visible.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(person);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-4"
              >
                <Avatar name={person.name} src={person.avatarUrl} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] text-ink-1">
                    {person.name}
                  </span>
                  {person.jobTitle ? (
                    <span className="block truncate text-[0.625rem] text-ink-4">
                      {person.jobTitle}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
