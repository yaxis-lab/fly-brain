"use client";

import React, {
  createContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { NeuronSearchResult } from "@/trpc/routers/neuronRouter";

export interface NeuronContextType {
  selectedNeurons: NeuronSearchResult[];
  addNeuron: (neuron: NeuronSearchResult) => void;
  removeNeuron: (bodyId: string) => void;
  toggleNeuron: (neuron: NeuronSearchResult) => void;
  clearNeurons: () => void;
}

export const NeuronContext = createContext<NeuronContextType | null>(null);

export function NeuronProvider({ children }: { children: React.ReactNode }) {
  const [selectedNeurons, setSelectedNeurons] = useState<NeuronSearchResult[]>(
    [],
  );

  const addNeuron = useCallback((neuron: NeuronSearchResult) => {
    setSelectedNeurons((prev) => {
      // Prevent duplicate selections
      if (prev.some((n) => n.bodyId === neuron.bodyId)) {
        return prev;
      }
      return [...prev, neuron];
    });
  }, []);

  const removeNeuron = useCallback((bodyId: string) => {
    setSelectedNeurons((prev) => prev.filter((n) => n.bodyId !== bodyId));
  }, []);

  const toggleNeuron = useCallback((neuron: NeuronSearchResult) => {
    setSelectedNeurons((prev) => {
      const exists = prev.some((n) => n.bodyId === neuron.bodyId);
      if (exists) {
        return prev.filter((n) => n.bodyId !== neuron.bodyId);
      }
      return [...prev, neuron];
    });
  }, []);

  const clearNeurons = useCallback(() => {
    setSelectedNeurons([]);
  }, []);

  const value = useMemo<NeuronContextType>(
    () => ({
      selectedNeurons,
      addNeuron,
      removeNeuron,
      toggleNeuron,
      clearNeurons,
    }),
    [selectedNeurons, addNeuron, removeNeuron, toggleNeuron, clearNeurons],
  );

  return (
    <NeuronContext.Provider value={value}>{children}</NeuronContext.Provider>
  );
}


