"use client";

import { useState } from "react";
import {
  ChevronRight,
  Monitor,
  Shield,
  Target,
  Users,
  Bell,
  RefreshCw,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import CommandCenterPage from "./activity/page";
import AgentNetworkPage from "./agent-network/page";
import OperationsPage from "./operations/page";
import IntelligencePage from "./intelligence/page";
import { useQuery } from "convex/react";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const userData = useQuery(api.users.getCurrentUser);
  const router = useRouter();

  // Memoize user data with fallbacks to prevent unnecessary re-renders
  const displayUserData = useMemo(() => {
    if (!userData) {
      return {
        name: "Loading...",
        avatar: null,
      };
    }

    return {
      name: userData.name || user?.firstName || "User",
      avatar: userData.avatar || null,
    };
  }, [userData, user]);

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div style={{ color: "hsl(var(--neutral-500))" }}>Loading…</div>
      </main>
    );
  }

  // Note: Authentication is now handled by middleware, but keeping this as a fallback
  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">
          You must be signed in to view the dashboard.
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`${sidebarCollapsed ? "w-16" : "w-70"} bg-neutral-900 border-r border-neutral-700 transition-all duration-300 fixed md:relative z-50 md:z-auto h-full md:h-auto ${!sidebarCollapsed ? "md:block" : ""}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <div className={`${sidebarCollapsed ? "hidden" : "block"}`}>
              <h1 className="text-orange-500 font-bold text-lg tracking-wider">
                KITE
              </h1>
              <p className="text-neutral-500 text-xs">V 0.1 CONTROL PANEL</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-neutral-400 hover:text-orange-500"
            >
              <ChevronRight
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              />
            </Button>
          </div>

          <nav className="space-y-2">
            {[
              { id: "overview", icon: Monitor, label: "COMMAND CENTER" },
              { id: "agents", icon: Users, label: "AGENT NETWORK" },
              { id: "operations", icon: Target, label: "OPERATIONS" },
              { id: "intelligence", icon: Shield, label: "INTELLIGENCE" },
              { id: "systems", icon: Settings, label: "SYSTEMS" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors ${
                  activeSection === item.id
                    ? "bg-orange-500 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                <item.icon className="w-5 h-5 md:w-5 md:h-5 sm:w-6 sm:h-6" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {!sidebarCollapsed && (
            <div className="mt-8 p-4 bg-neutral-800 border border-neutral-700 rounded">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-xs text-white">SYSTEM ONLINE</span>
              </div>
              <div className="text-xs text-neutral-500">
                <div>UPTIME: 72:14:33</div>
                <div>AGENTS: 847 ACTIVE</div>
                <div>MISSIONS: 23 ONGOING</div>
              </div>
            </div>
          )}

          {/* User Info and Sign Out */}
          {!sidebarCollapsed && (
            <div className="mt-4 p-4 bg-neutral-800 border border-neutral-700 rounded">
              <div className="text-xs text-neutral-400 mb-2">
                Welcome,{" "}
                {user.firstName || user.primaryEmailAddress?.emailAddress}
              </div>
              <SignOutButton>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-neutral-400 hover:text-orange-500"
                >
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col bg-neutral-900 ${!sidebarCollapsed ? "md:ml-0" : ""}`}
      >
        {/* Top Toolbar */}
        <div className="h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-400">
              TACTICAL COMMAND /{" "}
              <span className="text-orange-500">OVERVIEW</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-neutral-500">
              LAST UPDATE: 05/06/2025 20:00 UTC
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-orange-500"
            >
              <Bell className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-orange-500"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto bg-neutral-900">
          {activeSection === "overview" && <CommandCenterPage />}
          {activeSection === "agents" && <AgentNetworkPage />}
          {activeSection === "operations" && <OperationsPage />}
          {activeSection === "intelligence" && <IntelligencePage />}
          {activeSection === "systems" && <SystemsPage />}
        </div>
      </div>
    </div>
  );
}
