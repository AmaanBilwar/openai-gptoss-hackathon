"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SettingsPage() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();

  // Fetch user data and settings from Convex
  const userSettings = useQuery(api.settings.getUserSettings);

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
    >
      {/* Top Navigation Bar */}
      <div
        className="border-b px-6 py-4"
        style={{
          borderColor: "hsl(var(--border))",
          backgroundColor: "hsl(var(--card))",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ color: "hsl(var(--foreground))" }}
            >
              Settings
            </h1>
            <p
              className="mt-2"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Customize your Kite experience and manage your preferences
            </p>
          </div>
          <Badge
            variant="secondary"
            style={{
              backgroundColor: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {user?.emailAddresses[0]?.emailAddress}
          </Badge>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Appearance Settings */}
        <Card
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader>
            <CardTitle style={{ color: "hsl(var(--card-foreground))" }}>
              Appearance
            </CardTitle>
            <CardDescription style={{ color: "hsl(var(--muted-foreground))" }}>
              Customize how Kite looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                className="text-sm font-medium"
                style={{ color: "hsl(var(--card-foreground))" }}
              >
                Theme
              </label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  style={{
                    backgroundColor:
                      theme === "light" ? "hsl(var(--primary))" : "transparent",
                    color:
                      theme === "light"
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--foreground))",
                    borderColor:
                      theme === "light"
                        ? "hsl(var(--primary))"
                        : "hsl(var(--border))",
                  }}
                >
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  style={{
                    backgroundColor:
                      theme === "dark" ? "hsl(var(--primary))" : "transparent",
                    color:
                      theme === "dark"
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--foreground))",
                    borderColor:
                      theme === "dark"
                        ? "hsl(var(--primary))"
                        : "hsl(var(--border))",
                  }}
                >
                  Dark
                </Button>
                <Button
                  variant={theme === "auto" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("auto")}
                  style={{
                    backgroundColor:
                      theme === "auto" ? "hsl(var(--primary))" : "transparent",
                    color:
                      theme === "auto"
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--foreground))",
                    borderColor:
                      theme === "auto"
                        ? "hsl(var(--primary))"
                        : "hsl(var(--border))",
                  }}
                >
                  Auto
                </Button>
              </div>
              <p
                className="text-xs text-muted-foreground mt-1"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Auto follows your system preference
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader>
            <CardTitle style={{ color: "hsl(var(--card-foreground))" }}>
              Account
            </CardTitle>
            <CardDescription style={{ color: "hsl(var(--muted-foreground))" }}>
              Manage your account and profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                className="text-sm font-medium"
                style={{ color: "hsl(var(--card-foreground))" }}
              >
                Profile Visibility
              </label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  Public
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  Private
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader>
            <CardTitle style={{ color: "hsl(var(--card-foreground))" }}>
              Notifications
            </CardTitle>
            <CardDescription style={{ color: "hsl(var(--muted-foreground))" }}>
              Control how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: "hsl(var(--card-foreground))" }}
              >
                Email Receipts
              </span>
              <Button
                variant="outline"
                size="sm"
                style={{
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                }}
              >
                Enabled
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: "hsl(var(--card-foreground))" }}
              >
                Security Alerts
              </span>
              <Button
                variant="outline"
                size="sm"
                style={{
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                }}
              >
                Enabled
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Settings */}
        <Card
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader>
            <CardTitle style={{ color: "hsl(var(--card-foreground))" }}>
              API & Integrations
            </CardTitle>
            <CardDescription style={{ color: "hsl(var(--muted-foreground))" }}>
              Manage your API keys and integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                className="text-sm font-medium"
                style={{ color: "hsl(var(--card-foreground))" }}
              >
                API Key
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  type="password"
                  value="••••••••••••••••"
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                  style={{
                    backgroundColor: "hsl(var(--input))",
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          style={{
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
