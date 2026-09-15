import { useContext } from "react";
import { NeuronContext, NeuronContextType } from "@/context/NeuronContext";

export function useNeurons(): NeuronContextType {
  const context = useContext(NeuronContext);
  if (!context) {
    throw new Error("useNeurons must be used within a <NeuronProvider>");
  }
  return context;
}
