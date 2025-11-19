"use client";

import AdminNav from "@/app/admin/AdminNav";

type AdminSidebarProps = {
  notificationsCount?: number;
  bookingsNewCount?: number;
};

export function AdminSidebar({ notificationsCount = 0, bookingsNewCount = 0 }: AdminSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-20 h-screen w-72 border-r border-slate-800 bg-slate-950 text-slate-200 shadow-2xl rounded-r-3xl">
      {/* Header */}
      <div className="flex h-24 flex-col justify-center gap-1 border-b border-slate-800 px-6">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-violet-400 uppercase">Admin</p>
        <h2 className="text-lg font-semibold text-white">Control Center</h2>
      </div>

      <div className="flex h-[calc(100vh-6rem)] flex-col justify-between pb-6 pt-4">
        {/* Navigation */}
        <nav className="px-3">
          <AdminNav notificationsCount={notificationsCount} bookingsNewCount={bookingsNewCount} />
        </nav>

        {/* Bottom Section */}
        <div className="px-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">QuickWay Admin</p>
            <p className="mt-1 text-xs text-slate-500">Dashboard theme v1.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
