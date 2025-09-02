"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser, SignOutButton, SignInButton } from "@clerk/nextjs";
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
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const router = useRouter();

  // Get Clerk user state
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();

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
      { id: "attachments", label: "Attachments", icon: Globe },
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
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading Clerk authentication...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Not authenticated</p>
          <p className="text-neutral-400">Please sign in to access settings</p>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">
            Loading user profile from Convex...
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            This may take a moment on first visit
          </p>
        </div>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-yellow-400 text-lg mb-4">User profile not found</p>
          <p className="text-neutral-400">Your profile is being created...</p>
          <p className="text-xs text-neutral-500 mt-2">
            Please wait or refresh the page
          </p>
        </div>
      </div>
    );
  }

  // Don't wait for userSettings to load - it's optional
  const settings = userSettings || null;

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Top Navigation Bar */}
      <div className="border-b border-neutral-700 bg-neutral-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
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
                        ? "bg-orange-500 text-white"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-neutral-400 hover:text-white transition-colors">
              <Sun className="w-5 h-5" />
            </button>
            {isSignedIn ? (
              <SignOutButton>
                <button className="text-neutral-400 hover:text-white transition-colors">
                  Sign out
                </button>
              </SignOutButton>
            ) : (
              <SignInButton>
                <button className="text-neutral-400 hover:text-white transition-colors">
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
          <Card className="bg-neutral-800 border-neutral-700">
            <CardContent className="p-6 text-center">
              {userData.avatar && userData.avatar.startsWith("http") ? (
                <img
                  src={userData.avatar}
                  alt={userData.name}
                  className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">
                    {userData.avatar}
                  </span>
                </div>
              )}
              <h2 className="text-xl font-semibold text-white mb-1">
                {userData.name}
              </h2>
              <p className="text-neutral-400 mb-3">{userData.email}</p>

              {/* Bio */}
              {userData.bio && (
                <p className="text-sm text-neutral-300 mb-3 italic">
                  "{userData.bio}"
                </p>
              )}

              {/* Location */}
              {userData.location && (
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  {userData.location}
                </div>
              )}

              {/* GitHub Username */}
              {userData.githubUsername && (
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mb-3">
                  <Github className="w-4 h-4" />@{userData.githubUsername}
                </div>
              )}

              {/* Followers/Following */}
              <div className="flex items-center justify-center gap-4 text-sm mb-3">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-neutral-400" />
                  <span className="text-white font-medium">
                    {userData.followers}
                  </span>
                  <span className="text-neutral-400">followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white font-medium">
                    {userData.following}
                  </span>
                  <span className="text-neutral-400">following</span>
                </div>
              </div>

              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500">
                {userData.plan}
              </Badge>
            </CardContent>
          </Card>

          {/* Kite Usage Card */}
          <Card className="bg-neutral-800 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Kite Usage</CardTitle>
              <p className="text-sm text-neutral-400">
                Resets {userData.lastReset}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Standard Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-300">Standard</span>
                  <span className="text-white">
                    {userData.standardUsage.used}/{userData.standardUsage.total}
                  </span>
                </div>
                <div className="w-full bg-neutral-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(userData.standardUsage.used / userData.standardUsage.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  {userData.standardUsage.remaining} messages remaining
                </p>
              </div>

              {/* Premium Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-300">Premium</span>
                  <span className="text-white">
                    {userData.premiumUsage.used}/{userData.premiumUsage.total}
                  </span>
                </div>
                <div className="w-full bg-neutral-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(userData.premiumUsage.used / userData.premiumUsage.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  {userData.premiumUsage.remaining} messages remaining
                </p>
              </div>

              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Buy more premium credits →
              </Button>

              <p className="text-xs text-neutral-400 text-center">
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
                <h1 className="text-2xl font-bold text-white mb-6">
                  {userData.plan} Benefits
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {proPlanBenefits.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <Card
                        key={index}
                        className={`bg-neutral-800 border-neutral-700 ${
                          !benefit.available ? "opacity-60" : ""
                        }`}
                      >
                        <CardContent className="p-6 text-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                              benefit.available
                                ? "bg-orange-500/20"
                                : "bg-neutral-600/20"
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 ${
                                benefit.available
                                  ? "text-orange-500"
                                  : "text-neutral-400"
                              }`}
                            />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {benefit.title}
                          </h3>
                          <p
                            className="text-neutral-400 text-sm leading-relaxed"
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
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg">
                      Upgrade to Pro
                    </Button>
                  ) : (
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg">
                      Manage Subscription
                    </Button>
                  )}
                  <p className="text-sm text-neutral-400 mt-3">
                    * Premium credits are used for GPT Image Gen, o3, Claude
                    Sonnet, Gemini 2.5 Pro, GPT 5 (Reasoning), and Grok 3/4.
                    Additional Premium credits can be purchased separately for
                    $8 per 100.
                  </p>
                </div>
              </div>

              {/* Billing Preferences */}
              <Card className="bg-neutral-800 border-neutral-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Billing Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        Email me receipts
                      </p>
                      <p className="text-sm text-neutral-400">
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
                        className="block w-12 h-6 bg-neutral-600 rounded-full cursor-pointer"
                      >
                        <span className="block w-5 h-5 bg-white rounded-full transform transition-transform translate-x-0.5 translate-y-0.5"></span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-neutral-800 border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-400">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Delete Account</p>
                      <p className="text-sm text-neutral-400">
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                    <Button className="bg-red-600 hover:bg-red-700 text-white">
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
                <h1 className="text-2xl font-bold text-white mb-6">
                  Available Models
                </h1>
                <p className="text-neutral-400 mb-6">
                  Choose from our selection of AI models. Standard models use
                  standard credits, while premium models use premium credits.
                </p>
                {/* Open Source Models */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSignIcon className="w-5 h-5 text-green-500" />
                    Open Source Models
                    <Badge className="bg-white-500/20 text-green-400 border-green-500">
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
                        className="bg-neutral-800 border-neutral-700"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-lg font-semibold text-white">
                              {model.name}
                            </h3>
                            <Badge className={model.statusColor}>
                              {model.status}
                            </Badge>
                          </div>
                          <p className="text-neutral-400 text-sm mb-4">
                            {model.description}
                          </p>
                          <div className="space-y-2">
                            {model.capabilities.map((capability, capIndex) => (
                              <div
                                key={capIndex}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span className="text-neutral-300">
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
                  <h2 className="text-xl font-semibold text-neutral-500 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-neutral-500" />
                    Standard Models
                    <Badge className="bg-neutral-500/20 text-neutral-400 border-neutral-500">
                      Uses Standard Credits
                    </Badge>
                  </h2>
                  <p className="text-neutral-500 text-center py-8 text-lg">
                    Coming Soon
                  </p>
                </div>

                {/* Premium Models */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-neutral-500 mb-4 flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-neutral-500" />
                    Premium Models
                    <Badge className="bg-neutral-500/20 text-neutral-400 border-neutral-500">
                      Uses Premium Credits
                    </Badge>
                  </h2>
                  <p className="text-neutral-500 text-center py-8 text-lg">
                    Coming Soon
                  </p>
                </div>

                {/* Model Usage Statistics */}
                <Card className="bg-neutral-800 border-neutral-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Model Usage Statistics
                    </CardTitle>
                    <p className="text-sm text-neutral-400">
                      Track your usage across different model types
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-500 mb-1">
                          {userData.standardUsage.used}
                        </div>
                        <div className="text-sm text-neutral-400">
                          Standard Credits Used
                        </div>
                      </div>
                      <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-500 mb-1">
                          {userData.premiumUsage.used}
                        </div>
                        <div className="text-sm text-neutral-400">
                          Premium Credits Used
                        </div>
                      </div>
                      <div className="text-center p-4 bg-neutral-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-500 mb-1">
                          {userData.standardUsage.used +
                            userData.premiumUsage.used}
                        </div>
                        <div className="text-sm text-neutral-400">
                          Total Credits Used
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Model Preferences */}
                <Card className="bg-neutral-800 border-neutral-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Model Preferences
                    </CardTitle>
                    <p className="text-sm text-neutral-400">
                      Customize your default model selections
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          Default Standard Model
                        </p>
                        <p className="text-sm text-neutral-400">
                          Choose your preferred standard model for general tasks
                        </p>
                      </div>
                      <select className="bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-lg">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="claude-3.5-sonnet">
                          Claude 3.5 Sonnet
                        </option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          Default Premium Model
                        </p>
                        <p className="text-sm text-neutral-400">
                          Choose your preferred premium model for advanced tasks
                        </p>
                      </div>
                      <select className="bg-neutral-700 border border-neutral-600 text-white px-3 py-2 rounded-lg">
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
                        <p className="text-white font-medium">
                          Auto-switch to Premium
                        </p>
                        <p className="text-sm text-neutral-400">
                          Automatically use premium models for complex reasoning
                          tasks
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
                          className="block w-12 h-6 bg-neutral-600 rounded-full cursor-pointer"
                        >
                          <span className="block w-5 h-5 bg-white rounded-full transform transition-transform translate-x-0.5 translate-y-0.5"></span>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {activeTab === "customization" && (
            <>
              <Card className="bg-neutral-800 border-neutral-700">
                <CardHeader>
                  <CardTitle className="text-white">Appearance</CardTitle>
                  <p className="text-sm text-neutral-400">
                    Choose how Kite looks and feels
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-white font-medium mb-2">Theme</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTheme("light")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "light"
                            ? "bg-orange-500 text-white border-orange-500"
                            : "text-neutral-300 border-neutral-600 hover:bg-neutral-700"
                        }`}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "dark"
                            ? "bg-orange-500 text-white border-orange-500"
                            : "text-neutral-300 border-neutral-600 hover:bg-neutral-700"
                        }`}
                      >
                        Dark
                      </button>
                      <button
                        onClick={() => setTheme("auto")}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          theme === "auto"
                            ? "bg-orange-500 text-white border-orange-500"
                            : "text-neutral-300 border-neutral-600 hover:bg-neutral-700"
                        }`}
                      >
                        Auto
                      </button>
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
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
                <p className="text-neutral-400 text-lg">
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
