import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface Activity {
  _id: string;
  _creationTime: number;
  userId: string;
  sessionId?: string;
  toolName: string;
  toolCategory: string;
  status: string; // Allow string for compatibility with Convex
  input?: any;
  output?: any;
  error?: string;
  executionTimeMs?: number;
  timestamp: number;
  metadata?: {
    repository?: string;
    pullRequestNumber?: number;
    branch?: string;
    affectedFiles?: string[];
  };
}

export interface ActivityStats {
  total: number;
  successful: number;
  failed: number;
  last24h: number;
  successRate: number;
}

export function useActivities(limit?: number) {
  const activities = useQuery(api.activities.getRecentActivities, { limit });
  return activities;
}

export function useActivityStats() {
  const stats = useQuery(api.activities.getActivityStats, {});
  return stats;
}

// Helper function to format activity display text
export function formatActivityMessage(activity: Activity): string {
  const timeAgo = getTimeAgo(activity.timestamp);
  
  switch (activity.toolName) {
    case 'create_pr':
      return `Created pull request in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'merge_pr':
      return `Merged pull request #${activity.metadata?.pullRequestNumber || 'N/A'} in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'create_branch':
      return `Created branch '${activity.metadata?.branch || 'unknown'}' in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'commit_and_push':
      return `Committed and pushed changes to ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'intelligent_commit_split':
      return `Executed intelligent commit splitting in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'resolve_merge_conflicts':
      return `Resolved merge conflicts in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'create_issue':
      return `Created issue in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'update_issue':
      return `Updated issue in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'list_pull_requests':
      return `Listed pull requests in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    case 'list_repos':
      return `Listed repositories ${timeAgo}`;
    case 'checkout_branch':
      return `Checked out branch '${activity.metadata?.branch || 'unknown'}' in ${activity.metadata?.repository || 'repository'} ${timeAgo}`;
    default:
      return `Executed ${activity.toolName.replace(/_/g, ' ')} ${timeAgo}`;
  }
}

// Helper function to get category color
export function getActivityCategoryColor(category: string): string {
  switch (category) {
    case 'github':
      return 'text-orange-500';
    case 'ai':
      return 'text-blue-500';
    case 'file_ops':
      return 'text-green-500';
    default:
      return 'text-neutral-500';
  }
}

// Helper function to get status color
export function getActivityStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    case 'started':
      return 'bg-yellow-500';
    default:
      return 'bg-neutral-500';
  }
}

// Helper function to calculate time ago
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

// Helper function to format timestamp for display
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');
}
