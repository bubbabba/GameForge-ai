import { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground selection:bg-primary/30">
      <Sidebar />
      <main className="flex-1 ml-[240px] flex flex-col min-h-[100dvh]">
        {children}
      </main>
    </div>
  );
}