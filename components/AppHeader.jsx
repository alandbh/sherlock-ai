"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";

export default function AppHeader({ user, onLogout }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      {/* Left: Logo + title */}
      {/* <div className="flex items-center gap-3">
        <Image className="dark:invert" src="/logo-sherlock.svg" alt="Sherlock" width={32} height={37} />
        <span className="text-lg font-bold tracking-tight">Sherlock</span>
      </div> */}

      {/* Right: User info + theme toggle + logout */}
      <div className="flex items-center gap-3 ml-auto">
        <ThemeToggle />
        {user && (
          <>
            <div className="flex items-center gap-2">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name || "User"}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border"
                />
              )}
              <span className="hidden text-sm font-medium sm:inline">
                {user.name || user.email}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
