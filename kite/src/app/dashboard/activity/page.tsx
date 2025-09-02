"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useActivities,
  useActivityStats,
  formatActivityMessage,
  formatTimestamp,
  getActivityStatusColor,
  getActivityCategoryColor,
  type Activity,
} from "@/hooks/useActivities";

export default function ActivityPage() {
  const activities = useActivities(10); // Get last 10 activities
  const stats = useActivityStats();

  return (
    <div className="p-6 space-y-6">
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mission Activity Chart */}
        <Card
          className="lg:col-span-8"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-medium tracking-wider"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              ACTIVITY OVERVIEW
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 relative">
              {/* Chart Grid */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-20">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ borderColor: "hsl(var(--border))" }}
                    className="border"
                  ></div>
                ))}
              </div>
              {/* Y-axis labels */}
              <div
                className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs -ml-5 font-mono"
                style={{ color: "hsl(var(--muted-foreground))" }}
              ></div>
              {/* X-axis labels */}
              <div
                className="absolute bottom-0 left-0 w-full flex justify-between text-xs -mb-6 font-mono"
                style={{ color: "hsl(var(--muted-foreground))" }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Agent Status Overview */}

        {/* Activity Statistics */}
        <Card
          className="lg:col-span-4"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-medium tracking-wider"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              ACTIVITY STATISTICS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? (
              // Loading state
              <div className="space-y-4">
                <div className="animate-pulse">
                  <div
                    style={{ backgroundColor: "hsl(var(--neutral-800))" }}
                    className="h-4 rounded mb-2"
                  ></div>
                  <div
                    style={{ backgroundColor: "hsl(var(--neutral-700))" }}
                    className="h-6 rounded w-1/2"
                  ></div>
                </div>
                <div className="animate-pulse">
                  <div
                    style={{ backgroundColor: "hsl(var(--neutral-800))" }}
                    className="h-4 rounded mb-2"
                  ></div>
                  <div
                    style={{ backgroundColor: "hsl(var(--neutral-700))" }}
                    className="h-6 rounded w-1/3"
                  ></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      style={{ backgroundColor: "hsl(var(--green-500))" }}
                      className="w-2 h-2 rounded-full"
                    ></div>
                    <span
                      style={{ color: "hsl(var(--green-500))" }}
                      className="text-xs font-medium"
                    >
                      Successful Operations
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>
                        Total Completed
                      </span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {stats.successful}
                      </span>
                    </div>
                    {/* <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>Success Rate</span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {Math.round(stats.successRate)}%
                      </span>
                    </div> */}
                    <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>
                        Last 24h
                      </span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {stats.last24h}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      style={{ backgroundColor: "hsl(var(--red-500))" }}
                      className="w-2 h-2 rounded-full"
                    ></div>
                    <span
                      style={{ color: "hsl(var(--red-500))" }}
                      className="text-xs font-medium"
                    >
                      Failed Operations
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>
                        Total Failed
                      </span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {stats.failed}
                      </span>
                    </div>
                    {/* <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>Failure Rate</span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {Math.round(100 - stats.successRate)}%
                      </span>
                    </div> */}
                    <div className="flex justify-between text-xs">
                      <span style={{ color: "hsl(var(--neutral-400))" }}>
                        Total Operations
                      </span>
                      <span
                        style={{ color: "hsl(var(--foreground))" }}
                        className="font-bold font-mono"
                      >
                        {stats.total}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card
          className="lg:col-span-8"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle
              className="text-sm font-medium tracking-wider"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              ACTIVITY LOG
            </CardTitle>
            <div
              className="text-xs"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {activities ? `${activities.length} operations` : "Loading..."}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {!activities ? (
                // Loading state
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div
                        style={{ backgroundColor: "hsl(var(--neutral-800))" }}
                        className="h-4 rounded mb-2"
                      ></div>
                      <div
                        style={{ backgroundColor: "hsl(var(--neutral-700))" }}
                        className="h-3 rounded w-3/4"
                      ></div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                // Empty state
                <div className="text-center py-8">
                  <div
                    style={{ color: "hsl(var(--muted-foreground))" }}
                    className="text-sm"
                  >
                    No activities yet
                  </div>
                  <div
                    style={{ color: "hsl(var(--neutral-600))" }}
                    className="text-xs mt-1"
                  >
                    Start using Kite to see your activity log here
                  </div>
                </div>
              ) : (
                // Real activity data
                activities.map((activity: Activity) => (
                  <div
                    key={activity._id}
                    className="text-xs border-l-2 pl-3 p-2 rounded transition-colors"
                    style={{
                      borderLeftColor: "hsl(var(--primary))",
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "hsl(var(--neutral-800))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getActivityStatusColor(activity.status)}`}
                      ></div>
                      <div
                        style={{ color: "hsl(var(--muted-foreground))" }}
                        className="font-mono"
                      >
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                    <div style={{ color: "hsl(var(--foreground))" }}>
                      <span
                        className={`font-mono ${getActivityCategoryColor(activity.toolCategory)}`}
                      >
                        {activity.toolName.replace(/_/g, " ")}
                      </span>
                      {activity.status === "failed" ? (
                        <span style={{ color: "hsl(var(--red-400))" }}>
                          {" "}
                          - failed
                        </span>
                      ) : activity.status === "completed" ? (
                        <span style={{ color: "hsl(var(--green-400))" }}>
                          {" "}
                          - completed
                        </span>
                      ) : (
                        <span style={{ color: "hsl(var(--yellow-400))" }}>
                          {" "}
                          - in progress
                        </span>
                      )}
                    </div>
                    <div
                      style={{ color: "hsl(var(--neutral-400))" }}
                      className="text-xs mt-1"
                    >
                      {formatActivityMessage(activity)}
                    </div>
                    {activity.executionTimeMs && (
                      <div
                        style={{ color: "hsl(var(--neutral-600))" }}
                        className="text-xs"
                      >
                        {activity.executionTimeMs}ms
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
