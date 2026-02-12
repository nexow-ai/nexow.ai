"use client";

import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-800/40 bg-zinc-950/60 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search agents, instruments..."
            className="w-80 rounded-xl border border-zinc-800/40 bg-zinc-900/30 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 transition-all duration-200 focus:border-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 hover:border-zinc-700/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-xl p-2.5 text-zinc-500 transition-all duration-200 hover:bg-zinc-800/40 hover:text-zinc-300">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-800/60" />

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-400 shadow-lg shadow-emerald-500/10" />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-zinc-200">Trader</p>
            <p className="text-[11px] text-zinc-600">Free Plan</p>
          </div>
        </div>
      </div>
    </header>
  );
}
