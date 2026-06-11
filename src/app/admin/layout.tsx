import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
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
