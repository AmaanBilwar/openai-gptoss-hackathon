"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  useUser,
  SignOutButton,
  SignInButton,
  useClerk,
  useReverification,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  User,
  Bell,
  Palette,
  Database,
  Key,
  Globe,
  ArrowLeft,
  Sun,
  Rocket,
  Zap,
  Headphones,
  MapPin,
  Users,
  Github,
  DollarSignIcon,
  Trash2,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();

  // Get Clerk user state and clerk instance
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const deleteUserFromClerk = useReverification((user) => user?.delete());

  // Get theme functionality
  const { theme, setTheme } = useTheme();

  // Fetch user data and settings from Convex
  const user = useQuery(api.users.getCurrentUser);
  const userSettings = useQuery(api.users.getUserSettings);

  // Memoize tabs to prevent unnecessary re-renders
  const tabs = useMemo(
    () => [
      { id: "profile", label: "Account", icon: User },
      { id: "customization", label: "Customization", icon: Palette },
      { id: "history", label: "History & Sync", icon: Database },
      { id: "models", label: "Models", icon: Rocket },
      { id: "api", label: "API Keys", icon: Key },
      // { id: "attachments", label: "Attachments", icon: Globe },
      { id: "contact", label: "Contact Us", icon: Bell },
    ],
    []
  );

  // Memoize user data with fallbacks to prevent unnecessary re-renders
  const userData = useMemo(() => {
    if (!user) {
      return {
        name: "Loading...",
        email: "Loading...",
        plan: "Loading...",
        avatar: "?",
        bio: "",
        location: "",
        followers: 0,
        following: 0,
        githubUsername: "",
        standardUsage: { used: 0, total: 0, remaining: 0 },
        premiumUsage: { used: 0, total: 0, remaining: 0 },
        lastReset: "Loading...",
        planType: "free",
        planStatus: "trial",
      };
    }

    // Calculate usage and remaining credits
    const standardUsed = user.standardCreditsUsed || 0;
    const standardTotal = user.standardCreditsTotal || 100;
    const premiumUsed = user.premiumCreditsUsed || 0;
    const premiumTotal = user.premiumCreditsTotal || 0;

    // Format last reset date
    const lastResetDate = user.lastUsageReset
      ? new Date(user.lastUsageReset).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "Never";

    return {
      name: user.name || "Anonymous",
      email: user.email || "No email",
      plan:
        user.planType === "pro"
          ? "Pro Plan"
          : user.planType === "enterprise"
            ? "Enterprise Plan"
            : "Free Plan",
      avatar: user.avatar || user.name?.charAt(0)?.toUpperCase() || "?",
      bio: user.bio || "No bio yet",
      location: user.location || "No location set",
      followers: user.followers || 0,
      following: user.following || 0,
      githubUsername: user.githubUsername || "",
      standardUsage: {
        used: standardUsed,
        total: standardTotal,
        remaining: Math.max(0, standardTotal - standardUsed),
      },
      premiumUsage: {
        used: premiumUsed,
        total: premiumTotal,
        remaining: Math.max(0, premiumTotal - premiumUsed),
      },
      lastReset: lastResetDate,
      planType: user.planType || "free",
      planStatus: user.planStatus || "trial",
    };
  }, [user]);

  // Memoize pro plan benefits based on user's actual plan
  const proPlanBenefits = useMemo(() => {
    const isPro =
      userData.planType === "pro" || userData.planType === "enterprise";

    return [
      {
        icon: Rocket,
        title: "Access to All Models",
        description: isPro
          ? "You have access to our full suite of models including Claude, o3-mini-high, and more!"
          : "Upgrade to Pro to get access to our full suite of models including Claude, o3-mini-high, and more!",
        available: isPro,
      },
      {
        icon: Zap,
        title: "Generous Limits",
        description: isPro
          ? `You receive **${userData.standardUsage.total} standard credits** per month, plus **${userData.premiumUsage.total} premium credits*** per month.`
          : "Upgrade to Pro to receive **1500 standard credits** per month, plus **100 premium credits*** per month.",
        available: isPro,
      },
      {
        icon: Headphones,
        title: "Priority Support",
        description: isPro
          ? "You get faster responses and dedicated assistance from the T3 team whenever you need help!"
          : "Upgrade to Pro to get faster responses and dedicated assistance from the T3 team whenever you need help!",
        available: isPro,
      },
    ];
  }, [
    userData.planType,
    userData.standardUsage.total,
    userData.premiumUsage.total,
  ]);

  // Optimized tab click handler
  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  // Better loading and error states
  if (!clerkLoaded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: "hsl(var(--primary))" }}
          ></div>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Loading Clerk authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="text-center">
          <p
            className="text-lg mb-4"
            style={{ color: "hsl(var(--destructive))" }}
          >
            Not authenticated
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Please sign in to access settings
          </p>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: "hsl(var(--primary))" }}
          ></div>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Loading user profile from Convex...
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            This may take a moment on first visit
          </p>
        </div>
      </div>
    );
  }

  if (user === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: "hsl(var(--warning))" }}>
            User profile not found
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Your profile is being created...
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Please wait or refresh the page
          </p>
        </div>
      </div>
    );
  }

  // Don't wait for userSettings to load - it's optional
  const settings = userSettings || null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "hsl(var(--background))" }}
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
          <div className="flex items-center gap-6">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 transition-colors hover:underline"
              style={{
                color: "hsl(var(--muted-foreground))",
                textDecorationColor: "hsl(var(--orange-500))",
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>

            {/* Navigation Tabs */}
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? "text-white"
                        : "hover:text-white hover:bg-opacity-20"
                    }`}
                    style={{
                      backgroundColor:
                        activeTab === tab.id
                          ? "hsl(var(--primary))"
                          : "transparent",
                      color:
                        activeTab === tab.id
                          ? "hsl(var(--primary-foreground))"
                          : "hsl(var(--muted-foreground))",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="transition-colors"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <Sun className="w-5 h-5" />
            </button>
            {isSignedIn ? (
              <SignOutButton>
                <button
                  className="transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Sign out
                </button>
              </SignOutButton>
            ) : (
              <SignInButton>
                <button
                  className="transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 p-6">
        {/* Left Section - User Profile and Usage */}
        <div className="w-80 space-y-6">
          {/* User Profile Card */}
          <Card
            style={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <CardContent className="p-6 text-center">
              {userData.avatar && userData.avatar.startsWith("http") ? (
                <img
                  src={userData.avatar}
                  alt={userData.name}
                  className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                >
                  <span
                    className="text-2xl font-bold"
                    style={{ color: "hsl(var(--primary-foreground))" }}
                  >
                    {userData.avatar}
                  </span>
                </div>
              )}
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "hsl(var(--foreground))" }}
              >
                {userData.name}
              </h2>
              <p
                className="mb-3"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {userData.email}
              </p>

              {/* Bio */}
              {userData.bio && (
                <p
                  className="text-sm mb-3 italic"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  "{userData.bio}"
                </p>
              )}

              {/* Location */}
              {userData.location && (
                <div
                  className="flex items-center justify-center gap-2 text-sm mb-3"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <MapPin className="w-4 h-4" />
                  {userData.location}
                </div>
              )}

              {/* GitHub Username */}
              {userData.githubUsername && (
                <div
                  className="flex items-center justify-center gap-2 text-sm mb-3"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <Github className="w-4 h-4" />@{userData.githubUsername}
                </div>
              )}

              {/* Followers/Following */}
              <div className="flex items-center justify-center gap-4 text-sm mb-3">
                <div className="flex items-center gap-1">
                  <Users
                    className="w-4 h-4"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {userData.followers}
                  </span>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    followers
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {userData.following}
                  </span>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    following
                  </span>
                </div>
              </div>

              <Badge
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  borderColor: "hsl(var(--primary))",
                }}
              >
                {userData.plan}
              </Badge>
            </CardContent>
          </Card>

          {/* Kite Usage Card */}
          <Card
            style={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <CardHeader>
              <CardTitle
                className="text-lg"
                style={{ color: "hsl(var(--foreground))" }}
              >
                Kite Usage
              </CardTitle>
              <p
                className="text-sm"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Resets {userData.lastReset}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Standard Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    Standard
                  </span>
                  <span style={{ color: "hsl(var(--foreground))" }}>
                    {userData.standardUsage.used}/{userData.standardUsage.total}
                  </span>
                </div>
                <div
                  className="w-full rounded-full h-2 mb-1"
                  style={{ backgroundColor: "hsl(var(--muted))" }}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(userData.standardUsage.used / userData.standardUsage.total) * 100}%`,
                      backgroundColor: "hsl(var(--primary))",
                    }}
                  />
                </div>
                <p
                  className="text-xs"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {userData.standardUsage.remaining} messages remaining
                </p>
              </div>

              {/* Premium Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    Premium
                  </span>
                  <span style={{ color: "hsl(var(--foreground))" }}>
                    {userData.premiumUsage.used}/{userData.premiumUsage.total}
                  </span>
                </div>
                <div
                  className="w-full rounded-full h-2 mb-1"
                  style={{ backgroundColor: "hsl(var(--muted))" }}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(userData.premiumUsage.used / userData.premiumUsage.total) * 100}%`,
                      backgroundColor: "hsl(var(--primary))",
                    }}
                  />
                </div>
                <p
                  className="text-xs"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {userData.premiumUsage.remaining} messages remaining
                </p>
              </div>

              <Button
                className="w-full"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                Buy more premium credits →
              </Button>

              <p
                className="text-xs text-center"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Each tool call (e.g. search grounding) used in a reply consumes
                an additional standard credit. Models may not always utilize
                enabled tools.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Section - Main Content */}
        <div className="flex-1 space-y-6">
          {activeTab === "profile" && (
            <>
              {/* Plan Benefits */}
              <div>
                <h1
                  className="text-2xl font-bold mb-6"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {userData.plan} Benefits
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {proPlanBenefits.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <Card
                        key={index}
                        style={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          opacity: !benefit.available ? 0.6 : 1,
                        }}
                      >
                        <CardContent className="p-6 text-center">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                            style={{
                              backgroundColor: benefit.available
                                ? "hsl(var(--primary) / 0.2)"
                                : "hsl(var(--muted) / 0.2)",
                            }}
                          >
                            <Icon
                              className="w-6 h-6"
                              style={{
                                color: benefit.available
                                  ? "hsl(var(--primary))"
                                  : "hsl(var(--muted-foreground))",
                              }}
                            />
                          </div>
                          <h3
                            className="text-lg font-semibold mb-2"
                            style={{ color: "hsl(var(--foreground))" }}
                          >
                            {benefit.title}
                          </h3>
                          <p
                            className="text-sm leading-relaxed"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                            dangerouslySetInnerHTML={{
                              __html: benefit.description,
                            }}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="text-center mb-6">
                  {userData.planType === "free" ? (
                    <Button
                      className="px-8 py-3 text-lg"
                      style={{
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                    >
                      Upgrade to Pro
                    </Button>
                  ) : (
                    <Button
                      className="px-8 py-3 text-lg"
                      style={{
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                    >
                      Manage Subscription
                    </Button>
                  )}
                  <p
                    className="text-sm mt-3"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    * Premium credits are used for GPT Image Gen, o3, Claude
                    Sonnet, Gemini 2.5 Pro, GPT 5 (Reasoning), and Grok 3/4.
                    Additional Premium credits can be purchased separately for
                    $8 per 100.
                  </p>
                </div>
              </div>

              {/* Billing Preferences */}
              <Card
                style={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <CardHeader>
                  <CardTitle style={{ color: "hsl(var(--foreground))" }}>
                    Billing Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="font-medium"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        Email me receipts
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Send receipts to your account email when a payment
                        succeeds.
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        id="email-receipts"
                        defaultChecked={settings?.emailReceipts || false}
                      />
                      <label
                        htmlFor="email-receipts"
                        className="block w-12 h-6 rounded-full cursor-pointer"
                        style={{ backgroundColor: "hsl(var(--muted))" }}
                      >
                        <span
                          className="block w-5 h-5 rounded-full transform transition-transform translate-x-0.5 translate-y-0.5"
                          style={{ backgroundColor: "hsl(var(--foreground))" }}
                        ></span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card
                style={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--destructive) / 0.2)",
                }}
              >
                <CardHeader>
                  <CardTitle style={{ color: "hsl(var(--destructive))" }}>
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="font-medium"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        Delete Account
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                    <Button
                      style={{
                        backgroundColor: "hsl(var(--destructive))",
                        color: "hsl(var(--destructive-foreground))",
                      }}
                    >
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Other tabs content would go here */}
          {activeTab === "models" && (
            <>
              {/* Available Models */}
              <div>
                <h1
                  className="text-2xl font-bold mb-6"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  Available Models
                </h1>
                <p
                  className="mb-6"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Choose from our selection of AI models. Standard models use
                  standard credits, while premium models use premium credits.
                </p>
                {/* Open Source Models */}
                <div className="mb-8">
                  <h2
                    className="text-xl font-semibold mb-4 flex items-center gap-2"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    <DollarSignIcon
                      className="w-5 h-5"
                      style={{ color: "hsl(var(--green))" }}
                    />
                    Open Source Models
                    <Badge
                      style={{
                        backgroundColor: "hsl(var(--green-500) / 0.2)",
                        color: "hsl(var(--green-500))",
                        borderColor: "hsl(var(--green-500))",
                      }}
                    >
                      Uses Free Credits
                    </Badge>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      {
                        name: "GPT-OSS",
                        description:
                          "Latest GPT model with improved reasoning and coding capabilities",
                        capabilities: [
                          "Text Generation",
                          "Code Analysis",
                          "Reasoning",
                        ],
                        status: "Available",
                        statusColor:
                          "bg-green-500/20 text-green-400 border-green-500",
                      },
                    ].map((model, index) => (
                      <Card
                        key={index}
                        style={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                        }}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <h3
                              className="text-lg font-semibold"
                              style={{ color: "hsl(var(--foreground))" }}
                            >
                              {model.name}
                            </h3>
                            <Badge
                              style={{
                                backgroundColor: "hsl(var(--green-500) / 0.2)",
                                color: "hsl(var(--green-500))",
                                borderColor: "hsl(var(--green-500))",
                              }}
                            >
                              {model.status}
                            </Badge>
                          </div>
                          <p
                            className="text-sm mb-4"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            {model.description}
                          </p>
                          <div className="space-y-2">
                            {model.capabilities.map((capability, capIndex) => (
                              <div
                                key={capIndex}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: "hsl(var(--primary))",
                                  }}
                                ></div>
                                <span
                                  style={{
                                    color: "hsl(var(--muted-foreground))",
                                  }}
                                >
                                  {capability}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Standard Models */}
                <div className="mb-8">
                  <h2
                    className="text-xl font-semibold mb-4 flex items-center gap-2"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    <Zap
                      className="w-5 h-5"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    />
                    Standard Models
                    <Badge
                      style={{
                        backgroundColor: "hsl(var(--muted) / 0.2)",
                        color: "hsl(var(--muted-foreground))",
                        borderColor: "hsl(var(--muted))",
                      }}
                    >
                      Uses Standard Credits
                    </Badge>
                  </h2>
                  <p
                    className="text-center py-8 text-lg"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    Coming Soon
                  </p>
                </div>

                {/* Premium Models */}
                <div className="mb-8">
                  <h2
                    className="text-xl font-semibold mb-4 flex items-center gap-2"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    <Rocket
                      className="w-5 h-5"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    />
                    Premium Models
                    <Badge
                      style={{
                        backgroundColor: "hsl(var(--muted) / 0.2)",
                        color: "hsl(var(--muted-foreground))",
                        borderColor: "hsl(var(--muted))",
                      }}
                    >
                      Uses Premium Credits
                    </Badge>
                  </h2>
                  <p
                    className="text-center py-8 text-lg"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    Coming Soon
                  </p>
                </div>

                {/* Model Usage Statistics */}
                <div className="space-y-8">
                  <Card
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  >
                    <CardHeader>
                      <CardTitle style={{ color: "hsl(var(--foreground))" }}>
                        Model Usage Statistics
                      </CardTitle>
                      <p
                        className="text-sm"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Track your usage across different model types
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div
                          className="text-center p-4 rounded-lg"
                          style={{ backgroundColor: "hsl(var(--muted) / 0.5)" }}
                        >
                          <div
                            className="text-2xl font-bold mb-1"
                            style={{ color: "hsl(var(--orange-500))" }}
                          >
                            {userData.standardUsage.used}
                          </div>
                          <div
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Standard Credits Used
                          </div>
                        </div>
                        <div
                          className="text-center p-4 rounded-lg"
                          style={{ backgroundColor: "hsl(var(--muted) / 0.5)" }}
                        >
                          <div
                            className="text-2xl font-bold mb-1"
                            style={{ color: "hsl(var(--purple-500))" }}
                          >
                            {userData.premiumUsage.used}
                          </div>
                          <div
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Premium Credits Used
                          </div>
                        </div>
                        <div
                          className="text-center p-4 rounded-lg"
                          style={{ backgroundColor: "hsl(var(--muted) / 0.5)" }}
                        >
                          <div
                            className="text-2xl font-bold mb-1"
                            style={{ color: "hsl(var(--blue-500))" }}
                          >
                            {userData.standardUsage.used +
                              userData.premiumUsage.used}
                          </div>
                          <div
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Total Credits Used
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Model Preferences */}
                  <Card
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  >
                    <CardHeader>
                      <CardTitle style={{ color: "hsl(var(--foreground))" }}>
                        Model Preferences
                      </CardTitle>
                      <p
                        className="text-sm"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Customize your default model selections
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className="font-medium"
                            style={{ color: "hsl(var(--foreground))" }}
                          >
                            Default Standard Model
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Choose your preferred standard model for general
                            tasks
                          </p>
                        </div>
                        <select
                          className="px-3 py-2 rounded-lg"
                          style={{
                            backgroundColor: "hsl(var(--muted))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--foreground))",
                          }}
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="claude-3.5-sonnet">
                            Claude 3.5 Sonnet
                          </option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className="font-medium"
                            style={{ color: "hsl(var(--foreground))" }}
                          >
                            Default Premium Model
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Choose your preferred premium model for advanced
                            tasks
                          </p>
                        </div>
                        <select
                          className="px-3 py-2 rounded-lg"
                          style={{
                            backgroundColor: "hsl(var(--muted))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--foreground))",
                          }}
                        >
                          <option value="gpt-5-reasoning">
                            GPT-5 (Reasoning)
                          </option>
                          <option value="claude-3.5-sonnet-premium">
                            Claude 3.5 Sonnet (Premium)
                          </option>
                          <option value="grok-3">Grok 3</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className="font-medium"
                            style={{ color: "hsl(var(--foreground))" }}
                          >
                            Auto-switch to Premium
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            Automatically use premium models for complex
                            reasoning tasks
                          </p>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            id="auto-premium"
                            defaultChecked={false}
                          />
                          <label
                            htmlFor="auto-premium"
                            className="block w-12 h-6 rounded-full cursor-pointer"
                            style={{ backgroundColor: "hsl(var(--muted))" }}
                          >
                            <span
                              className="block w-5 h-5 rounded-full transform transition-transform translate-x-0.5 translate-y-0.5"
                              style={{
                                backgroundColor: "hsl(var(--foreground))",
                              }}
                            ></span>
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}

          {activeTab === "customization" && (
            <>
              <Card
                style={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <CardHeader>
                  <CardTitle style={{ color: "hsl(var(--foreground))" }}>
                    Appearance
                  </CardTitle>
                  <p
                    className="text-sm"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    Choose how Kite looks and feels
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p
                      className="font-medium mb-2"
                      style={{ color: "hsl(var(--foreground))" }}
                    >
                      Theme
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTheme("light")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "light"
                            ? "text-white border-orange-500"
                            : "hover:bg-opacity-20"
                        }`}
                        style={{
                          backgroundColor:
                            theme === "light"
                              ? "hsl(var(--primary))"
                              : "transparent",
                          color:
                            theme === "light"
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--muted-foreground))",
                          borderColor:
                            theme === "light"
                              ? "hsl(var(--primary))"
                              : "hsl(var(--border))",
                        }}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "dark"
                            ? "text-white border-orange-500"
                            : "hover:bg-opacity-20"
                        }`}
                        style={{
                          backgroundColor:
                            theme === "dark"
                              ? "hsl(var(--primary))"
                              : "transparent",
                          color:
                            theme === "dark"
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--muted-foreground))",
                          borderColor:
                            theme === "dark"
                              ? "hsl(var(--primary))"
                              : "hsl(var(--border))",
                        }}
                      >
                        Dark
                      </button>
                      <button
                        onClick={() => setTheme("auto")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "auto"
                            ? "text-white border-orange-500"
                            : "hover:bg-opacity-20"
                        }`}
                        style={{
                          backgroundColor:
                            theme === "auto"
                              ? "hsl(var(--primary))"
                              : "transparent",
                          color:
                            theme === "auto"
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--muted-foreground))",
                          borderColor:
                            theme === "auto"
                              ? "hsl(var(--primary))"
                              : "hsl(var(--border))",
                        }}
                      >
                        Auto
                      </button>
                    </div>
                    <p
                      className="text-xs mt-2"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      Auto follows your system preference
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab !== "profile" &&
            activeTab !== "models" &&
            activeTab !== "customization" && (
              <div className="text-center py-12">
                <p
                  className="text-lg"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {tabs.find((tab) => tab.id === activeTab)?.label} settings
                  coming soon...
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
