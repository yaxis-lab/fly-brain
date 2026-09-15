"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { trpc } from "@/trpc/client";
import type { NeuronSearchResult } from "@/trpc/routers/neuronRouter";
import { useNeurons } from "@/hooks/useNeuron";

export default function NeuronSearchBar() {
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery] = useDebounce(query, 300);
  const { addNeuron, selectedNeurons, clearNeurons } = useNeurons();
  const { data } = useQuery({
    ...trpc.neuron.search.queryOptions({ query: debouncedQuery, limit: 10 }),
    enabled: debouncedQuery.trim().length > 0,
  });

  function handleSelect(neuron: NeuronSearchResult) {
    clearNeurons();
    addNeuron(neuron);
  }

  return (
    <div className="relative min-w-lg w-max">
      <div className="w-full flex items-center rounded-full px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-neutral-200 transition-all">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search by name or body_id (e.g., T4)"
          className="w-full bg-transparent border-none outline-none text-sm text-neutral-800 placeholder:text-neutral-400 ml-3"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {query.trim().length > 0 && (
        <div className="absolute top-full mt-2 min-h-40 flex flex-col w-full bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden">
          {data?.map((item) => (
            <button
              key={item.bodyId}
              onClick={() => {
                handleSelect(item);
              }}
              className="w-full flex justify-between px-4 py-2 hover:bg-neutral-50 transition-colors"
            >
              <span className="text-sm text-neutral-500 font-medium">
                {item.type || item.instance}
              </span>
              <span className="text-xs text-neutral-400">#{item.bodyId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
