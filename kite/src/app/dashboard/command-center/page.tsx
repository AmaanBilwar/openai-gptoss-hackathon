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

export default function CommandCenterPage() {
  const activities = useActivities(10); // Get last 10 activities
  const stats = useActivityStats();

  return (
    <div className="p-6 space-y-6">
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mission Activity Chart */}
        <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              MISSION ACTIVITY OVERVIEW
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 relative">
              {/* Chart Grid */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-20">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="border border-neutral-700"></div>
                ))}
              </div>

              {/* Chart Line */}
              <svg className="absolute inset-0 w-full h-full">
                <polyline
                  points="0,120 50,100 100,110 150,90 200,95 250,85 300,100 350,80"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2"
                />
                <polyline
                  points="0,140 50,135 100,130 150,125 200,130 250,135 300,125 350,120"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              </svg>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-neutral-500 -ml-5 font-mono">
                <span>500</span>
                <span>400</span>
                <span>300</span>
                <span>200</span>
              </div>

              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-neutral-500 -mb-6 font-mono">
                <span>Jan 28, 2025</span>
                <span>Feb 28, 2025</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent Status Overview */}

        {/* Activity Statistics */}
        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              ACTIVITY STATISTICS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? (
              // Loading state
              <div className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-neutral-800 rounded mb-2"></div>
                  <div className="h-6 bg-neutral-700 rounded w-1/2"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-4 bg-neutral-800 rounded mb-2"></div>
                  <div className="h-6 bg-neutral-700 rounded w-1/3"></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-500 font-medium">
                      Successful Operations
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Total Completed</span>
                      <span className="text-white font-bold font-mono">
                        {stats.successful}
                      </span>
                    </div>
                    {/* <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Success Rate</span>
                      <span className="text-white font-bold font-mono">
                        {Math.round(stats.successRate)}%
                      </span>
                    </div> */}
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Last 24h</span>
                      <span className="text-white font-bold font-mono">
                        {stats.last24h}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-500 font-medium">
                      Failed Operations
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Total Failed</span>
                      <span className="text-white font-bold font-mono">
                        {stats.failed}
                      </span>
                    </div>
                    {/* <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Failure Rate</span>
                      <span className="text-white font-bold font-mono">
                        {Math.round(100 - stats.successRate)}%
                      </span>
                    </div> */}
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Total Operations</span>
                      <span className="text-white font-bold font-mono">
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
        <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              ACTIVITY LOG
            </CardTitle>
            <div className="text-xs text-neutral-500">
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
                      <div className="h-4 bg-neutral-800 rounded mb-2"></div>
                      <div className="h-3 bg-neutral-700 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                // Empty state
                <div className="text-center py-8">
                  <div className="text-neutral-500 text-sm">
                    No activities yet
                  </div>
                  <div className="text-neutral-600 text-xs mt-1">
                    Start using Kite to see your activity log here
                  </div>
                </div>
              ) : (
                // Real activity data
                activities.map((activity: Activity) => (
                  <div
                    key={activity._id}
                    className="text-xs border-l-2 border-orange-500 pl-3 hover:bg-neutral-800 p-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getActivityStatusColor(activity.status)}`}
                      ></div>
                      <div className="text-neutral-500 font-mono">
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                    <div className="text-white">
                      <span
                        className={`font-mono ${getActivityCategoryColor(activity.toolCategory)}`}
                      >
                        {activity.toolName.replace(/_/g, " ")}
                      </span>
                      {activity.status === "failed" ? (
                        <span className="text-red-400"> - failed</span>
                      ) : activity.status === "completed" ? (
                        <span className="text-green-400"> - completed</span>
                      ) : (
                        <span className="text-yellow-400"> - in progress</span>
                      )}
                    </div>
                    <div className="text-neutral-400 text-xs mt-1">
                      {formatActivityMessage(activity)}
                    </div>
                    {activity.executionTimeMs && (
                      <div className="text-neutral-600 text-xs">
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
