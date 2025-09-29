import React, { useState, useEffect } from 'react';
import { X, History } from 'lucide-react';
import { userService } from '../services/userService';
import { assetService } from '../services/assetService';
import AssetHistoryList from './AssetHistoryList';

const AssignAssetModal = ({ asset, onClose, onAssetAssigned }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      const result = await userService.getAllUsers();
      if (result.success) {
        setUsers(result.users);
      } else {
        setError(result.error);
      }
      setUsersLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if(error) {
      alert(`Error fetching users: ${error}`);
    }
  }, [error]);

  const handleAssign = async () => {
    if (!selectedUser) {
      alert('Please select a user.');
      return;
    }
    const result = await assetService.assignAsset(asset.id, selectedUser, handoverDate);
    if (result.success) {
      onAssetAssigned();
      onClose();
    } else {
      setError(result.error);
    }
  };

  const usersByDepartment = users.reduce((acc, user) => {
    const department = user.department || 'Other';
    if (!acc[department]) {
      acc[department] = [];
    }
    acc[department].push(user);
    return acc;
  }, {});

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
    setSelectedUser(''); // Reset user selection
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 sm:p-4 md:p-6 w-full max-w-xs sm:max-w-md md:max-w-lg">
        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Assign Asset</h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleHistory} 
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-cyan-400 transition-colors"
              title="View Asset Track Log"
            >
              <History className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
        
        {showHistory ? (
          <div className="pt-6">
            <AssetHistoryList assetId={asset.id} />
            <div className="flex justify-end mt-6">
              <button onClick={toggleHistory} className="btn-secondary">
                Back to Assignment
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-6 space-y-6">
            <p className="text-slate-400 text-sm">
              You are assigning asset: <span className="font-semibold text-cyan-400">{asset.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="department-select" className="block text-sm font-medium text-slate-300 mb-2">
                  Department
                </label>
                <select
                  id="department-select"
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                  className="input-field w-full"
                  disabled={usersLoading}
                >
                  <option value="">{usersLoading ? 'Loading Departments...' : 'Select Department'}</option>
                  {Object.keys(usersByDepartment).sort().map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="user-select" className="block text-sm font-medium text-slate-300 mb-2">
                  Assign to
                </label>
                <select
                  id="user-select"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="input-field w-full"
                  disabled={!selectedDepartment}
                >
                  <option value="">Select User</option>
                  {selectedDepartment &&
                    usersByDepartment[selectedDepartment].map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullname}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="handover-date" className="block text-sm font-medium text-slate-300 mb-2">
                  Handover Date
                </label>
                <input
                  type="date"
                  id="handover-date"
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{`Error: ${error}`}</p>}
            <div className="flex justify-end space-x-4 pt-4">
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleAssign} className="btn-primary" disabled={!selectedUser}>
                Assign Asset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignAssetModal; 