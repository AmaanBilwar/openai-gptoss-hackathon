"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Eye,
  Download,
  Filter,
  Globe,
  Shield,
  AlertTriangle,
} from "lucide-react";

interface Report {
  id: string;
  title: string;
  classification: string;
  source: string;
  location: string;
  date: string;
  status: string;
  threat: string;
  summary: string;
  tags: string[];
}

export default function IntelligencePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const reports: Report[] = [
    {
      id: "INT-2025-001",
      title: "CYBERCRIME NETWORK ANALYSIS",
      classification: "TOP SECRET",
      source: "SIGINT",
      location: "Eastern Europe",
      date: "2025-06-17",
      status: "verified",
      threat: "high",
      summary:
        "Detailed analysis of emerging cybercrime syndicate operating across multiple jurisdictions",
      tags: ["cybercrime", "international", "financial"],
    },
    {
      id: "INT-2025-002",
      title: "ROGUE AGENT COMMUNICATIONS",
      classification: "SECRET",
      source: "HUMINT",
      location: "Berlin",
      date: "2025-06-16",
      status: "pending",
      threat: "critical",
      summary:
        "Intercepted communications suggesting potential security breach in European operations",
      tags: ["internal", "security", "communications"],
    },
    {
      id: "INT-2025-003",
      title: "ARMS TRAFFICKING ROUTES",
      classification: "CONFIDENTIAL",
      source: "OSINT",
      location: "Middle East",
      date: "2025-06-15",
      status: "verified",
      threat: "medium",
      summary:
        "Updated intelligence on weapons smuggling corridors through Mediterranean region",
      tags: ["trafficking", "weapons", "maritime"],
    },
    {
      id: "INT-2025-004",
      title: "TERRORIST CELL SURVEILLANCE",
      classification: "TOP SECRET",
      source: "HUMINT",
      location: "North Africa",
      date: "2025-06-14",
      status: "active",
      threat: "critical",
      summary:
        "Ongoing surveillance of suspected terrorist cell planning coordinated attacks",
      tags: ["terrorism", "surveillance", "coordinated"],
    },
    {
      id: "INT-2025-005",
      title: "DIPLOMATIC INTELLIGENCE BRIEF",
      classification: "SECRET",
      source: "DIPLOMATIC",
      location: "Asia Pacific",
      date: "2025-06-13",
      status: "verified",
      threat: "low",
      summary:
        "Political developments affecting regional security and operational considerations",
      tags: ["diplomatic", "political", "regional"],
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "hsl(var(--green-500))";
      case "pending":
        return "hsl(var(--orange-500))";
      case "active":
        return "hsl(var(--red-500))";
      default:
        return "hsl(var(--neutral-500))";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "verified":
        return "hsl(var(--green-500) / 0.2)";
      case "pending":
        return "hsl(var(--orange-500) / 0.2)";
      case "active":
        return "hsl(var(--red-500) / 0.2)";
      default:
        return "hsl(var(--neutral-500) / 0.2)";
    }
  };

  const getThreatColor = (threat: string) => {
    switch (threat) {
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

  const getThreatBgColor = (threat: string) => {
    switch (threat) {
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

  const getThreatWidth = (threat: string) => {
    switch (threat) {
      case "critical":
        return "w-full";
      case "high":
        return "w-3/4";
      case "medium":
        return "w-1/2";
      case "low":
        return "w-1/4";
      default:
        return "w-1/4";
    }
  };

  const getThreatBarColor = (threat: string) => {
    switch (threat) {
      case "critical":
        return "hsl(var(--red-500))";
      case "high":
        return "hsl(var(--orange-500))";
      case "medium":
        return "hsl(var(--neutral-400))";
      case "low":
        return "hsl(var(--neutral-400))";
      default:
        return "hsl(var(--neutral-400))";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
            Intelligence Center
          </h1>
          <p className="text-sm" style={{ color: "hsl(var(--neutral-400))" }}>
            Analyze and manage intelligence reports and threat assessments
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            style={{ 
              backgroundColor: "hsl(var(--orange-500))",
              color: "hsl(var(--foreground))"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500) / 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500))";
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            New Report
          </Button>
          <Button 
            style={{ 
              backgroundColor: "hsl(var(--orange-500))",
              color: "hsl(var(--foreground))"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500) / 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "hsl(var(--orange-500))";
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Advanced Search
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card 
          className="lg:col-span-2"
          style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
        >
          <CardContent className="p-4">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
                style={{ color: "hsl(var(--neutral-400))" }}
              />
              <Input
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                style={{
                  backgroundColor: "hsl(var(--neutral-800))",
                  borderColor: "hsl(var(--neutral-600))",
                  color: "hsl(var(--foreground))"
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="lg:col-span-2"
          style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
        >
          <CardContent className="p-4">
            <p className="text-xs tracking-wider" style={{ color: "hsl(var(--neutral-400))" }}>
              TOTAL REPORTS
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-2xl font-bold font-mono" style={{ color: "hsl(var(--foreground))" }}>
                {reports.length}
              </p>
              <FileText className="w-8 h-8" style={{ color: "hsl(var(--foreground))" }} />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="lg:col-span-2"
          style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
        >
          <CardContent className="p-4">
            <p className="text-xs tracking-wider" style={{ color: "hsl(var(--neutral-400))" }}>
              CRITICAL THREATS
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-2xl font-bold font-mono" style={{ color: "hsl(var(--red-500))" }}>
                {reports.filter(r => r.threat === "critical").length}
              </p>
              <AlertTriangle className="w-8 h-8" style={{ color: "hsl(var(--red-500))" }} />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="lg:col-span-2"
          style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
        >
          <CardContent className="p-4">
            <p className="text-xs tracking-wider" style={{ color: "hsl(var(--neutral-400))" }}>
              VERIFIED REPORTS
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-2xl font-bold font-mono" style={{ color: "hsl(var(--green-500))" }}>
                {reports.filter(r => r.status === "verified").length}
              </p>
              <Shield className="w-8 h-8" style={{ color: "hsl(var(--green-500))" }} />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="lg:col-span-4"
          style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
        >
          <CardContent className="p-4">
            <CardTitle className="text-sm font-medium tracking-wider" style={{ color: "hsl(var(--neutral-300))" }}>
              THREAT DISTRIBUTION
            </CardTitle>
            <div className="mt-4 space-y-3">
              {["critical", "high", "medium", "low"].map((level) => (
                <div key={level} className="flex items-center justify-between">
                  <span className="text-xs capitalize" style={{ color: "hsl(var(--neutral-400))" }}>
                    {level}
                  </span>
                  <div className="w-20 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(var(--neutral-700))" }}>
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${(reports.filter(r => r.threat === level).length / reports.length) * 100}%`,
                        backgroundColor: getThreatBarColor(level)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card 
        className="w-full"
        style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
      >
        <CardHeader>
          <CardTitle className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            Intelligence Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border rounded p-4 hover:border-orange-500/50 transition-colors cursor-pointer"
                style={{ borderColor: "hsl(var(--neutral-700))" }}
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 mt-0.5" style={{ color: "hsl(var(--neutral-400))" }} />
                  <div className="flex-1">
                    <p className="text-xs font-mono" style={{ color: "hsl(var(--neutral-400))" }}>
                      {report.id}
                    </p>
                    <h3 className="text-sm ml-8" style={{ color: "hsl(var(--neutral-300))" }}>
                      {report.title}
                    </h3>
                    <div className="flex gap-2 mt-2">
                      <Badge 
                        style={{
                          backgroundColor: "hsl(var(--neutral-800))",
                          color: "hsl(var(--neutral-300))"
                        }}
                        className="text-xs"
                      >
                        {report.classification}
                      </Badge>
                      <Badge
                        style={{
                          backgroundColor: getStatusBgColor(report.status),
                          color: getStatusColor(report.status)
                        }}
                        className="text-xs"
                      >
                        {report.status}
                      </Badge>
                      <Badge
                        style={{
                          backgroundColor: getThreatBgColor(report.threat),
                          color: getThreatColor(report.threat)
                        }}
                        className="text-xs"
                      >
                        {report.threat}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1 mt-3" style={{ color: "hsl(var(--neutral-400))" }}>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3" />
                        {report.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        {report.source}
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        {report.date}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card 
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "hsl(var(--neutral-900))", borderColor: "hsl(var(--neutral-700))" }}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-mono" style={{ color: "hsl(var(--neutral-400))" }}>
                  {selectedReport.id}
                </p>
                <CardTitle className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
                  {selectedReport.title}
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
                onClick={() => setSelectedReport(null)}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium tracking-wider mb-2" style={{ color: "hsl(var(--neutral-300))" }}>
                  REPORT METADATA
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span style={{ color: "hsl(var(--neutral-400))" }}>Source Type:</span>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {selectedReport.source}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--neutral-400))" }}>Location:</span>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {selectedReport.location}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--neutral-400))" }}>Date:</span>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {selectedReport.date}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--neutral-400))" }}>Status:</span>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {selectedReport.status}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium tracking-wider mb-2" style={{ color: "hsl(var(--neutral-300))" }}>
                  THREAT ASSESSMENT
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "hsl(var(--neutral-400))" }}>Threat Level</span>
                    <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {selectedReport.threat.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "hsl(var(--neutral-800))" }}>
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getThreatWidth(selectedReport.threat)}`}
                      style={{ backgroundColor: getThreatBarColor(selectedReport.threat) }}
                    ></div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium tracking-wider mb-2" style={{ color: "hsl(var(--neutral-300))" }}>
                  SUMMARY
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--neutral-300))" }}>
                  {selectedReport.summary}
                </p>
              </div>

              <div className="flex gap-2 pt-4" style={{ borderTopColor: "hsl(var(--neutral-700))" }} className="border-t">
                <Button 
                  style={{ 
                    backgroundColor: "hsl(var(--orange-500))",
                    color: "hsl(var(--foreground))"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "hsl(var(--orange-500) / 0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "hsl(var(--orange-500))";
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Report
                </Button>
                <Button
                  variant="outline"
                  style={{
                    borderColor: "hsl(var(--neutral-700))",
                    color: "hsl(var(--neutral-400))"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "hsl(var(--neutral-800))";
                    e.currentTarget.style.color = "hsl(var(--neutral-300))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "hsl(var(--neutral-400))";
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  style={{
                    borderColor: "hsl(var(--neutral-700))",
                    color: "hsl(var(--neutral-400))"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "hsl(var(--neutral-800))";
                    e.currentTarget.style.color = "hsl(var(--neutral-300))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "hsl(var(--neutral-400))";
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Edit Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
