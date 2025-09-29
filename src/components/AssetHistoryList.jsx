import React, { useState, useEffect } from 'react';
import { Clock, User, Calendar, AlertCircle, Loader2, Tag, CheckCircle } from 'lucide-react';
import { assetService } from '../services/assetService';

const AssetHistoryList = ({ assetId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const result = await assetService.getAssetHistory(assetId);
      if (result.success) {
        setHistory(result.history);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    if (assetId) {
      fetchHistory();
    }
  }, [assetId]);

  // Format date to a readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format status for display
  const formatStatus = (status) => {
    switch (status) {
      case 'free':
        return 'Free to Use';
      case 'using':
        return 'Using';
      case 'maintenance':
        return 'Maintenance';
      case 'retired':
        return 'Retired';
      default:
        return status;
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'free':
        return 'text-blue-400';
      case 'using':
        return 'text-green-400';
      case 'maintenance':
        return 'text-yellow-400';
      case 'retired':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-6 h-6 text-cyan-400 mx-auto mb-2 animate-spin" />
        <p className="text-slate-400">Loading asset track logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
        <p className="text-red-400">Error loading logs: {error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-slate-400">No track logs found for this asset.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Asset Track Logs</h3>
      <div className="space-y-4">
        {history.map((record) => (
          <div key={record.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            {record.type === 'assignment' ? (
              // Assignment log
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-cyan-400 mr-2" />
                    <span className="text-white font-medium">
                      {record.assignedTo.fullname}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDate(record.createdAt)}
                  </span>
                </div>
                
                <div className="flex items-center mb-2">
                  <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-sm text-slate-300">
                    Handover date: {formatDate(record.handoverDate)}
                  </span>
                </div>
                
                <div className="flex items-center mb-2">
                  <Clock className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-sm text-slate-300">
                    Previous user: {record.previousUser ? record.previousUser.fullname : 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center text-xs text-slate-500 mt-2">
                  <span>Assigned by {record.assignedBy.fullname}</span>
                </div>
              </>
            ) : (
              // Status change log
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 text-cyan-400 mr-2" />
                    <span className="text-white font-medium">
                      Status Changed to <span className={getStatusColor(record.newStatus)}>{formatStatus(record.newStatus)}</span>
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDate(record.createdAt)}
                  </span>
                </div>
                
                {record.previousStatus && (
                  <div className="flex items-center mb-2">
                    <Clock className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-sm text-slate-300">
                      Previous status: {formatStatus(record.previousStatus)}
                    </span>
                  </div>
                )}
                
                {record.previousUser && (
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-sm text-slate-300">
                      Unassigned from: {record.previousUser.fullname}
                    </span>
                  </div>
                )}
                
                {record.unassignedDate && (
                  <div className="flex items-center mb-2">
                    <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-sm text-slate-300">
                      Unassigned date: {formatDate(record.unassignedDate)}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center text-xs text-slate-500 mt-2">
                  <span>Changed by {record.changedBy?.fullname || 'Unknown'}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetHistoryList; 