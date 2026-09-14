"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { BrainViewer } from "@/components/viewer/BrainViewer";
import { NeuroglancerTest } from "@/components/neuroglancer/NeuroglancerTest";

export default function Home() {
  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Sidebar />

      <main className="relative min-w-0 flex-1 h-full w-full ms-28">
        <BrainViewer />
      </main>
      {/*<NeuroglancerTest />*/}
    </div>
  );
}
