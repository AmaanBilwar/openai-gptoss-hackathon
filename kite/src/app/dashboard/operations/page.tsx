"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface Operation {
  id: string;
  name: string;
  status: string;
  priority: string;
  location: string;
  agents: number;
  progress: number;
  startDate: string;
  estimatedCompletion: string;
  description: string;
  objectives: string[];
}

export default function OperationsPage() {
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null
  );

  const operations: Operation[] = [
    {
      id: "OP-OMEGA-001",
      name: "SHADOW PROTOCOL",
      status: "active",
      priority: "critical",
      location: "Eastern Europe",
      agents: 5,
      progress: 75,
      startDate: "2025-06-15",
      estimatedCompletion: "2025-06-30",
      description: "Track high-value target in Eastern Europe",
      objectives: [
        "Locate target",
        "Establish surveillance",
        "Extract intelligence",
      ],
    },
    {
      id: "OP-DELTA-002",
      name: "GHOST FIRE",
      status: "planning",
      priority: "high",
      location: "Seoul",
      agents: 3,
      progress: 25,
      startDate: "2025-06-20",
      estimatedCompletion: "2025-07-05",
      description: "Infiltrate cybercrime network in Seoul",
      objectives: [
        "Penetrate network",
        "Gather evidence",
        "Identify key players",
      ],
    },
    {
      id: "OP-SIERRA-003",
      name: "NIGHT STALKER",
      status: "completed",
      priority: "medium",
      location: "Berlin",
      agents: 2,
      progress: 100,
      startDate: "2025-05-28",
      estimatedCompletion: "2025-06-12",
      description: "Monitor rogue agent communications in Berlin",
      objectives: [
        "Intercept communications",
        "Decode messages",
        "Report findings",
      ],
    },
    {
      id: "OP-ALPHA-004",
      name: "CRIMSON TIDE",
      status: "active",
      priority: "high",
      location: "Cairo",
      agents: 4,
      progress: 60,
      startDate: "2025-06-10",
      estimatedCompletion: "2025-06-25",
      description: "Support covert extraction in South America",
      objectives: [
        "Secure extraction point",
        "Provide cover fire",
        "Ensure safe passage",
      ],
    },
    {
      id: "OP-BRAVO-005",
      name: "SILENT STORM",
      status: "on-hold",
      priority: "low",
      location: "Tokyo",
      agents: 1,
      progress: 10,
      startDate: "2025-06-25",
      estimatedCompletion: "2025-07-10",
      description: "Gather intelligence on corporate espionage",
      objectives: ["Infilitrate facility", "Access database", "Extract data"],
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "hsl(var(--green-500))";
      case "planning":
        return "hsl(var(--orange-500))";
      case "completed":
        return "hsl(var(--green-500))";
      case "on-hold":
        return "hsl(var(--red-500))";
      default:
        return "hsl(var(--neutral-500))";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "active":
        return "hsl(var(--green-500) / 0.2)";
      case "planning":
        return "hsl(var(--orange-500) / 0.2)";
      case "completed":
        return "hsl(var(--green-500) / 0.2)";
      case "on-hold":
        return "hsl(var(--red-500) / 0.2)";
      default:
        return "hsl(var(--neutral-500) / 0.2)";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "hsl(var(--red-500))";
      case "high":
        return "hsl(var(--orange-500))";
      case "medium":
        return "hsl(var(--neutral-500))";
      case "low":
        return "hsl(var(--neutral-500))";
      default:
        return "hsl(var(--neutral-500))";
    }
  };

  const getPriorityBgColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "hsl(var(--red-500) / 0.2)";
      case "high":
        return "hsl(var(--orange-500) / 0.2)";
      case "medium":
        return "hsl(var(--neutral-500) / 0.2)";
      case "low":
        return "hsl(var(--neutral-500) / 0.2)";
      default:
        return "hsl(var(--neutral-500) / 0.2)";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Operations Center
          </h1>
          <p className="text-sm" style={{ color: "hsl(var(--neutral-400))" }}>
            Monitor and manage active field operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            style={{
              backgroundColor: "hsl(var(--orange-500))",
              color: "hsl(var(--foreground))",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "hsl(var(--orange-500) / 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500))";
            }}
          >
            <Target className="w-4 h-4 mr-2" />
            New Operation
          </Button>
          <Button
            style={{
              backgroundColor: "hsl(var(--orange-500))",
              color: "hsl(var(--foreground))",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "hsl(var(--orange-500) / 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500))";
            }}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Emergency Protocol
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card
          className="lg:col-span-1"
          style={{
            backgroundColor: "hsl(var(--neutral-900))",
            borderColor: "hsl(var(--neutral-700))",
          }}
        >
          <CardContent className="p-4">
            <p
              className="text-xs tracking-wider"
              style={{ color: "hsl(var(--neutral-400))" }}
            >
              ACTIVE OPERATIONS
            </p>
            <div className="flex items-center justify-between mt-2">
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: "hsl(var(--green-500))" }}
              >
                {operations.filter((op) => op.status === "active").length}
              </p>
              <Target
                className="w-8 h-8"
                style={{ color: "hsl(var(--green-500))" }}
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className="lg:col-span-1"
          style={{
            backgroundColor: "hsl(var(--neutral-900))",
            borderColor: "hsl(var(--neutral-700))",
          }}
        >
          <CardContent className="p-4">
            <p
              className="text-xs tracking-wider"
              style={{ color: "hsl(var(--neutral-400))" }}
            >
              PLANNING PHASE
            </p>
            <div className="flex items-center justify-between mt-2">
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: "hsl(var(--orange-500))" }}
              >
                {operations.filter((op) => op.status === "planning").length}
              </p>
              <Clock
                className="w-8 h-8"
                style={{ color: "hsl(var(--orange-500))" }}
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className="lg:col-span-1"
          style={{
            backgroundColor: "hsl(var(--neutral-900))",
            borderColor: "hsl(var(--neutral-700))",
          }}
        >
          <CardContent className="p-4">
            <p
              className="text-xs tracking-wider"
              style={{ color: "hsl(var(--neutral-400))" }}
            >
              COMPLETED
            </p>
            <div className="flex items-center justify-between mt-2">
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: "hsl(var(--green-500))" }}
              >
                {operations.filter((op) => op.status === "completed").length}
              </p>
              <CheckCircle
                className="w-8 h-8"
                style={{ color: "hsl(var(--green-500))" }}
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className="lg:col-span-1"
          style={{
            backgroundColor: "hsl(var(--neutral-900))",
            borderColor: "hsl(var(--neutral-700))",
          }}
        >
          <CardContent className="p-4">
            <p
              className="text-xs tracking-wider"
              style={{ color: "hsl(var(--neutral-400))" }}
            >
              ON HOLD
            </p>
            <div className="flex items-center justify-between mt-2">
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: "hsl(var(--red-500))" }}
              >
                {operations.filter((op) => op.status === "on-hold").length}
              </p>
              <XCircle
                className="w-8 h-8"
                style={{ color: "hsl(var(--red-500))" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {operations.map((operation) => (
          <Card
            key={operation.id}
            className="hover:border-orange-500/50 transition-colors cursor-pointer"
            style={{
              backgroundColor: "hsl(var(--neutral-900))",
              borderColor: "hsl(var(--neutral-700))",
            }}
            onClick={() => setSelectedOperation(operation)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-xs font-mono"
                    style={{ color: "hsl(var(--neutral-400))" }}
                  >
                    {operation.id}
                  </p>
                  <CardTitle
                    className="text-lg font-bold"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {operation.name}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge
                    style={{
                      backgroundColor: getStatusBgColor(operation.status),
                      color: getStatusColor(operation.status),
                    }}
                  >
                    {operation.status}
                  </Badge>
                  <Badge
                    style={{
                      backgroundColor: getPriorityBgColor(operation.priority),
                      color: getPriorityColor(operation.priority),
                    }}
                  >
                    {operation.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "hsl(var(--neutral-400))" }}
              >
                <MapPin className="w-3 h-3" />
                {operation.location}
              </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "hsl(var(--neutral-400))" }}
              >
                <Users className="w-3 h-3" />
                {operation.agents} agents
              </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "hsl(var(--neutral-400))" }}
              >
                <Clock className="w-3 h-3" />
                {operation.startDate}
              </div>

              <div>
                <span style={{ color: "hsl(var(--neutral-400))" }}>
                  Progress
                </span>
                <div
                  className="w-full rounded-full h-2 mt-2"
                  style={{ backgroundColor: "hsl(var(--neutral-800))" }}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${operation.progress}%`,
                      backgroundColor: "hsl(var(--orange-500))",
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Operation Details Modal */}
      {selectedOperation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "hsl(var(--neutral-900))",
              borderColor: "hsl(var(--neutral-700))",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <p
                  className="text-sm font-mono"
                  style={{ color: "hsl(var(--neutral-400))" }}
                >
                  {selectedOperation.id}
                </p>
                <CardTitle
                  className="text-xl font-bold"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {selectedOperation.name}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                style={{ color: "hsl(var(--neutral-400))" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "hsl(var(--foreground))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "hsl(var(--neutral-400))";
                }}
                onClick={() => setSelectedOperation(null)}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3
                  className="text-sm font-medium tracking-wider mb-2"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  OPERATION DETAILS
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  {selectedOperation.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span style={{ color: "hsl(var(--neutral-400))" }}>
                    Location:
                  </span>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {selectedOperation.location}
                  </p>
                </div>
                <div>
                  <span style={{ color: "hsl(var(--neutral-400))" }}>
                    Agents:
                  </span>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {selectedOperation.agents}
                  </p>
                </div>
                <div>
                  <span style={{ color: "hsl(var(--neutral-400))" }}>
                    Start Date:
                  </span>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {selectedOperation.startDate}
                  </p>
                </div>
                <div>
                  <span style={{ color: "hsl(var(--neutral-400))" }}>
                    Estimated Completion:
                  </span>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {selectedOperation.estimatedCompletion}
                  </p>
                </div>
              </div>

              <div>
                <h3
                  className="text-sm font-medium tracking-wider mb-2"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  PROGRESS
                </h3>
                <div
                  className="w-full rounded-full h-3 mt-2"
                  style={{ backgroundColor: "hsl(var(--neutral-800))" }}
                >
                  <div
                    className="h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${selectedOperation.progress}%`,
                      backgroundColor: "hsl(var(--orange-500))",
                    }}
                  ></div>
                </div>
                <p
                  className="text-sm mt-2"
                  style={{ color: "hsl(var(--neutral-400))" }}
                >
                  {selectedOperation.progress}% complete
                </p>
              </div>

              <div>
                <h3
                  className="text-sm font-medium tracking-wider mb-2"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  OBJECTIVES
                </h3>
                <div className="space-y-2">
                  {selectedOperation.objectives.map((objective, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "hsl(var(--orange-500))" }}
                      ></div>
                      <span style={{ color: "hsl(var(--neutral-300))" }}>
                        {objective}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3
                  className="text-sm font-medium tracking-wider mb-2"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  STATUS
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "hsl(var(--neutral-300))" }}
                >
                  Operation is currently {selectedOperation.status}
                </p>
              </div>

              <div
                className="flex gap-2 pt-4 border-t"
                style={{ borderTopColor: "hsl(var(--neutral-700))" }}
              >
                <Button
                  style={{
                    backgroundColor: "hsl(var(--orange-500))",
                    color: "hsl(var(--foreground))",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "hsl(var(--orange-500) / 0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "hsl(var(--orange-500))";
                  }}
                >
                  Update Status
                </Button>
                <Button
                  variant="outline"
                  style={{
                    borderColor: "hsl(var(--neutral-700))",
                    color: "hsl(var(--neutral-400))",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "hsl(var(--neutral-800))";
                    e.currentTarget.style.color = "hsl(var(--neutral-300))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "hsl(var(--neutral-400))";
                  }}
                >
                  View Logs
                </Button>
                <Button
                  variant="outline"
                  style={{
                    borderColor: "hsl(var(--neutral-700))",
                    color: "hsl(var(--neutral-400))",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "hsl(var(--neutral-800))";
                    e.currentTarget.style.color = "hsl(var(--neutral-300))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "hsl(var(--neutral-400))";
                  }}
                >
                  Edit Operation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
