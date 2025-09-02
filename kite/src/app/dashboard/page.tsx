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
  Moon,
  Sun,
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
import { useTheme } from "@/components/ThemeProvider";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const userData = useQuery(api.users.getCurrentUser);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
        <div style={{ color: "hsl(var(--neutral-500))" }}>
          You must be signed in to view the dashboard.
        </div>
      </main>
    );
  }

  const handleSettingsClick = () => {
    router.push("/settings");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`${sidebarCollapsed ? "w-16" : "w-70"} border-r transition-all duration-300 fixed md:relative z-50 md:z-auto h-full md:h-auto ${!sidebarCollapsed ? "md:block" : ""}`}
        style={{
          backgroundColor: "hsl(var(--sidebar))",
          borderColor: "hsl(var(--sidebar-border))",
        }}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className={`${sidebarCollapsed ? "hidden" : "block"}`}>
              <h1
                style={{
                  color: "hsl(var(--sidebar-primary))",
                  fontWeight: "bold",
                  fontSize: "1.125rem",
                  letterSpacing: "0.05em",
                }}
              >
                KITE
              </h1>
              <p
                style={{
                  color: "hsl(var(--sidebar-foreground))",
                  fontSize: "0.75rem",
                }}
              >
                V 0.1 CONTROL PANEL
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                style={{ color: "hsl(var(--sidebar-foreground))" }}
                className="dashboard-button-hover"
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                style={{ color: "hsl(var(--sidebar-foreground))" }}
                className="dashboard-button-hover"
              >
                <ChevronRight
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
                />
              </Button>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            {[
              { id: "overview", icon: Monitor, label: "Activity" },
              { id: "agents", icon: Users, label: "Agent Network" },
              { id: "operations", icon: Target, label: "Operations" },
              { id: "intelligence", icon: Shield, label: "Intelligence" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors dashboard-nav-item`}
                style={{
                  backgroundColor:
                    activeSection === item.id
                      ? "hsl(var(--sidebar-primary))"
                      : "transparent",
                  color:
                    activeSection === item.id
                      ? "hsl(var(--sidebar-primary-foreground))"
                      : "hsl(var(--sidebar-foreground))",
                }}
              >
                <item.icon className="w-5 h-5 md:w-5 md:h-5 sm:w-6 sm:h-6" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* User Info - Now clickable to go to settings */}
          {!sidebarCollapsed && (
            <button
              onClick={handleSettingsClick}
              className="mt-auto p-4 border rounded transition-colors cursor-pointer text-left w-full dashboard-user-section"
              style={{
                borderColor: "hsl(var(--sidebar-border))",
                color: "hsl(var(--sidebar-foreground))",
              }}
            >
              <div className="flex items-center gap-3">
                {/* User Avatar */}
                {!userData ? (
                  // Loading state
                  <div
                    style={{ backgroundColor: "hsl(var(--sidebar-accent))" }}
                    className="w-10 h-10 rounded-full flex items-center justify-center animate-pulse"
                  >
                    <div
                      style={{
                        borderColor: "hsl(var(--sidebar-foreground))",
                        borderTopColor: "transparent",
                      }}
                      className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                    ></div>
                  </div>
                ) : displayUserData.avatar &&
                  displayUserData.avatar.startsWith("http") ? (
                  <img
                    src={displayUserData.avatar}
                    alt={displayUserData.name || "User"}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: "hsl(var(--sidebar-primary))" }}
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                  >
                    <span
                      style={{
                        color: "hsl(var(--sidebar-primary-foreground))",
                      }}
                      className="text-sm font-bold"
                    >
                      {displayUserData.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}

                {/* User Info */}
                <div className="flex flex-col">
                  <div
                    style={{ color: "hsl(var(--sidebar-foreground))" }}
                    className="text-sm font-medium"
                  >
                    {!userData ? (
                      <span style={{ color: "hsl(var(--sidebar-foreground))" }}>
                        Loading...
                      </span>
                    ) : (
                      user.firstName || user.primaryEmailAddress?.emailAddress
                    )}
                  </div>
                  <div
                    style={{ color: "hsl(var(--sidebar-accent-foreground))" }}
                    className="text-xs"
                  >
                    {userData?.planType === "pro" ||
                    userData?.planType === "enterprise"
                      ? "Pro"
                      : "Free"}
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: "hsl(var(--overlay))" }}
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col ${!sidebarCollapsed ? "md:ml-0" : ""}`}
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Top Toolbar */}
        <div
          className="h-16 border-b flex items-center justify-between px-6"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="text-sm"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <span style={{ color: "hsl(var(--primary))" }}>DASHBOARD</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              style={{ color: "hsl(var(--muted-foreground))" }}
              className="text-xs"
            >
              LAST UPDATE:{" "}
            </div>
            <Button
              variant="ghost"
              size="icon"
              style={{ color: "hsl(var(--muted-foreground))" }}
              className="dashboard-button-hover"
            >
              <Bell className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              style={{ color: "hsl(var(--muted-foreground))" }}
              className="dashboard-button-hover"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "hsl(var(--background))" }}
        >
          {activeSection === "overview" && <CommandCenterPage />}
          {activeSection === "agents" && <AgentNetworkPage />}
          {activeSection === "operations" && <OperationsPage />}
          {activeSection === "intelligence" && <IntelligencePage />}
        </div>
      </div>
    </div>
  );
}
