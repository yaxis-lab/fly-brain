"use client";

import NeuronSearchBar from "@/components/layout/NeuronSearchBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { BrainViewer } from "@/components/viewer/BrainViewer";

export default function Home() {
  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Sidebar />

      <main className="relative min-w-0 flex-1 h-full w-full ms-17">
        <header className="w-full flex items-center justify-end p-3 border-b border-b-zinc-200">
          <NeuronSearchBar />
        </header>
        <BrainViewer />
      </main>
    </div>
  );
}
