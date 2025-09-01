'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState } from 'react';

export function QueueMonitor() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Query queue health and stats
  const queueHealth = useQuery(api.processing.getQueueHealth, {});
  const processingStats = useQuery(api.processing.getProcessingStats, {});
  const queueItems = useQuery(api.processing.getNextQueueItems, { limit: 10 });

  // Mutations for queue management
  const triggerProcessing = useMutation(api.processing.triggerQueueProcessing);
  const resetStuckItems = useMutation(api.processing.resetStuckItems);

  const handleTriggerProcessing = async () => {
    setIsRefreshing(true);
    try {
      await triggerProcessing({});
      console.log('✅ Queue processing triggered');
    } catch (error) {
      console.error('❌ Failed to trigger processing:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetStuckItems = async () => {
    setIsRefreshing(true);
    try {
      const result = await resetStuckItems({});
      console.log(`✅ Reset ${result.reset} stuck items`);
    } catch (error) {
      console.error('❌ Failed to reset stuck items:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!queueHealth || !processingStats) {
    return <div className="p-4">Loading queue status...</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Queue Monitor</h2>
        <div className="flex gap-2">
          <button
            onClick={handleTriggerProcessing}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRefreshing ? 'Processing...' : 'Trigger Processing'}
          </button>
          <button
            onClick={handleResetStuckItems}
            disabled={isRefreshing}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            Reset Stuck Items
          </button>
        </div>
      </div>

      {/* Queue Health Status */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Queue Health</h3>
        <div className={`p-4 rounded-lg ${queueHealth.isHealthy ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${queueHealth.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              {queueHealth.isHealthy ? 'Healthy' : 'Issues Detected'}
            </span>
          </div>
          {queueHealth.issues.length > 0 && (
            <ul className="text-sm text-red-700">
              {queueHealth.issues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{queueHealth.queued}</div>
          <div className="text-sm text-blue-700">Queued</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{queueHealth.processing}</div>
          <div className="text-sm text-yellow-700">Processing</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{queueHealth.completed}</div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{queueHealth.failed}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
      </div>

      {/* Processing Statistics */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Processing Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Commits</h4>
            <div className="space-y-1 text-sm">
              <div>Pending: {processingStats.commits.pending}</div>
              <div>Processing: {processingStats.commits.parsing + processingStats.commits.embedding}</div>
              <div>Completed: {processingStats.commits.completed}</div>
              <div>Failed: {processingStats.commits.failed}</div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Pull Requests</h4>
            <div className="space-y-1 text-sm">
              <div>Pending: {processingStats.prs.pending}</div>
              <div>Processing: {processingStats.prs.parsing + processingStats.prs.embedding}</div>
              <div>Completed: {processingStats.prs.completed}</div>
              <div>Failed: {processingStats.prs.failed}</div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Performance</h4>
            <div className="space-y-1 text-sm">
              <div>Avg Processing Time: {Math.round(queueHealth.averageProcessingTime / 1000)}s</div>
              <div>Recent Activity: {queueHealth.recentActivity}</div>
              <div>Stuck Items: {queueHealth.stuckItems}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Queue Items */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Queue Items</h3>
        {queueItems && queueItems.length > 0 ? (
          <div className="space-y-2">
            {queueItems.map((item) => (
              <div key={item._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {item.targetType === 'commit' ? 'Commit' : 'PR'} {item.targetId}
                  </div>
                  <div className="text-sm text-gray-600">
                    Priority: {item.priority} • Attempts: {item.attempts}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  item.status === 'queued' ? 'bg-blue-100 text-blue-800' :
                  item.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                  item.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">No items in queue</div>
        )}
      </div>
    </div>
  );
}
