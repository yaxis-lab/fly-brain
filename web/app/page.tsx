"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { BrainViewer } from "@/components/viewer/BrainViewer";

export default function Home() {
  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Sidebar />
      
      <main className="min-w-0 flex-1 h-full w-full">
        <BrainViewer />
      </main>
    </div>
  );
}
