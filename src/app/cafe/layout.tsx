import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { QuickStatsBar } from "@/components/layout/quick-stats-bar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const dynamic = "force-dynamic";

export default function CafeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <QuickStatsBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto pb-20 lg:pb-6">
          <Breadcrumbs className="mb-3" />
          {children}
        </main>
      </div>
    </>
  );
}
