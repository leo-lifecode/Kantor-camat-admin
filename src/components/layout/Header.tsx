"use client";

import { Bell, Menu } from "lucide-react";

type HeaderProps = {
  onMenuClick?: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
          aria-label="Buka menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Dashboard Admin
          </h2>
          <p className="text-xs text-gray-500">
            Sistem Antrian Digital
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-xl p-2.5 text-gray-600 hover:bg-gray-100"
          aria-label="Notifikasi"
        >
          <Bell size={20} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-purple-600" />
        </button>

        <div className="hidden items-center gap-3 border-l pl-3 sm:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 font-semibold text-purple-700">
            A
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              Admin
            </p>
            <p className="text-xs text-gray-500">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
