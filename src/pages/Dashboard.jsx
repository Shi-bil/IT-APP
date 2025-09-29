import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Package, 
  Users, 
  Ticket, 
  Shield, 
  TrendingUp, 
  Activity, 
  AlertTriangle,
  Clock,
  BarChart3,
  XCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { assetService } from '../services/assetService';
import { userService } from '../services/userService';
import { ticketService } from '../services/ticketService';
import { credentialService } from '../services/credentialService';

const Dashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');
  const isAdmin = user?.role === 'admin';

  // Real data states
  const [assetCount, setAssetCount] = useState(0);
  const [credentialCount, setCredentialCount] = useState(0);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [assetData, setAssetData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticketStatusData, setTicketStatusData] = useState([]);
  const [solvedTicketCount, setSolvedTicketCount] = useState(0);

  // Add a metric for non-admins: My Assets
  const myAssetsMetric = {
    title: 'My Assets',
    value: 0, // Will be set below
    change: '+0%',
    trend: 'up',
    icon: Package,
    color: 'from-blue-500 to-cyan-500'
  };

  useEffect(() => {
    if (location.state?.accessDenied) {
      setShowAccessDenied(true);
      setAccessDeniedMessage(location.state.message || 'You do not have access to the requested page');
      const timer = setTimeout(() => {
        setShowAccessDenied(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError('');
      try {
        // Assets
        let assetsRes;
        if (isAdmin) {
          assetsRes = await assetService.getAllAssets();
        } else {
          assetsRes = await assetService.getUserAssets();
        }
        let assetActs = [];
        if (assetsRes.success) {
          if (!isAdmin) myAssetsMetric.value = assetsRes.assets.length;
          setAssetCount(assetsRes.assets.length);
          // Asset growth by month (dummy grouping by createdAt month for demo)
          const monthMap = {};
          assetsRes.assets.forEach(asset => {
            const date = new Date(asset.createdAt);
            const month = date.toLocaleString('default', { month: 'short' });
            monthMap[month] = (monthMap[month] || 0) + 1;
          });
          setAssetData(Object.entries(monthMap).map(([name, assets]) => ({ name, assets })));
          // Asset status breakdown
          const statusMap = {};
          assetsRes.assets.forEach(asset => {
            statusMap[asset.status] = (statusMap[asset.status] || 0) + 1;
          });
          const statusColors = {
            active: '#10b981',
            maintenance: '#f59e0b',
            inactive: '#6b7280',
            retired: '#ef4444',
            using: '#3b82f6',
            free: '#6366f1',
          };
          setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: statusColors[name] || '#6b7280' })));
          assetActs = assetsRes.assets.slice(0, 10).map(a => ({
            type: 'asset',
            action: 'Asset ' + (a.createdAt === a.updatedAt ? 'created' : 'updated'),
            description: a.name,
            performedBy: a.createdBy?.fullname || a.createdBy?.username || a.createdBy?.email || 'System',
            timestamp: a.updatedAt ? formatTimeAgo(a.updatedAt) : '',
            icon: Package,
            color: 'text-blue-400',
            date: a.updatedAt || a.createdAt
          }));
        }
        // Credentials
        const credsRes = await credentialService.getAllCredentials();
        let credActs = [];
        if (credsRes.success) {
          setCredentialCount(credsRes.credentials.length);
          credActs = credsRes.credentials.slice(0, 10).map(c => ({
            type: 'credential',
            action: 'Credential ' + (c.createdAt === c.updatedAt ? 'created' : 'updated'),
            description: c.name,
            performedBy: c.createdBy?.fullname || c.createdBy?.username || c.createdBy?.email || 'System',
            timestamp: c.updatedAt ? formatTimeAgo(c.updatedAt) : '',
            icon: Shield,
            color: 'text-purple-400',
            date: c.updatedAt || c.createdAt
          }));
        }
        // Tickets
        const ticketsRes = isAdmin ? await ticketService.getAllTickets() : await ticketService.getUserTickets();
        let ticketActs = [];
        if (ticketsRes.success) {
          setOpenTicketCount(ticketsRes.tickets.filter(t => t.status === 'open').length);
          setSolvedTicketCount(ticketsRes.tickets.filter(t => t.status === 'resolved').length);
          // Ticket status breakdown for chart
          const tStatusMap = {};
          ticketsRes.tickets.forEach(ticket => {
            tStatusMap[ticket.status] = (tStatusMap[ticket.status] || 0) + 1;
          });
          const tStatusColors = {
            open: '#3b82f6',
            'in-progress': '#f59e0b',
            resolved: '#10b981',
            closed: '#ef4444',
          };
          setTicketStatusData(Object.entries(tStatusMap).map(([name, value]) => ({ name: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value, color: tStatusColors[name] || '#6b7280' })));
          ticketActs = ticketsRes.tickets.slice(0, 10).map(t => ({
            type: 'ticket',
            action: 'Ticket ' + (t.createdAt === t.updatedAt ? 'created' : 'updated'),
            description: t.title,
            performedBy: t.createdBy?.fullname || t.createdBy?.username || t.createdBy?.email || 'System',
            timestamp: t.updatedAt ? formatTimeAgo(t.updatedAt) : '',
            icon: Ticket,
            color: 'text-orange-400',
            date: t.updatedAt || t.createdAt
          }));
        }
        // Users
        const usersRes = await userService.getAllUsers();
        let userActs = [];
        if (usersRes.success) {
          setUserCount(usersRes.users.length);
          userActs = usersRes.users.slice(0, 10).map(u => ({
            type: 'user',
            action: 'User ' + (u.createdAt === u.updatedAt ? 'created' : 'updated'),
            description: u.fullname,
            performedBy: u.fullname || u.username || u.email || 'System',
            timestamp: u.updatedAt ? formatTimeAgo(u.updatedAt) : '',
            icon: Users,
            color: 'text-green-400',
            date: u.updatedAt || u.createdAt
          }));
        }
        // Combine and sort all activities
        const allActs = [...assetActs, ...ticketActs, ...userActs, ...credActs]
          .filter(a => a.date)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);
        setRecentActivity(allActs);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [isAdmin]);

  // Helper for time ago
  function formatTimeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  }

  const metrics = [
    {
      title: 'Total Assets',
      value: assetCount,
      change: '+12%',
      trend: 'up',
      icon: Package,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Total Credentials',
      value: credentialCount,
      change: '+3%',
      trend: 'up',
      icon: Shield,
      color: 'from-purple-500 to-indigo-500'
    },
    {
      title: 'Open Tickets',
      value: openTicketCount,
      change: '-8%',
      trend: 'down',
      icon: Ticket,
      color: 'from-orange-500 to-red-500'
    },
    {
      title: 'Total Users',
      value: userCount,
      change: '+5%',
      trend: 'up',
      icon: Users,
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {showAccessDenied && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 sm:px-4 py-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="font-medium">{accessDeniedMessage}</p>
          </div>
          <button 
            onClick={() => setShowAccessDenied(false)}
            className="text-red-300 hover:text-red-100"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">Dashboard</h1>
          <p className="text-slate-400 text-sm sm:text-base">
            {`Welcome back, ${user?.fullname || 'User'}! ${
              isAdmin 
                ? 'Here\'s what\'s happening with your System.'
                : 'Here\'s what\'s available to you.'
            }`}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-1 sm:mt-2">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          if (!isAdmin && metric.title !== 'Open Tickets') return null;
          return (
            <div
              key={index}
              className="relative group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/20 shadow-lg rounded-2xl px-3 sm:px-4 py-4 sm:py-5 flex flex-row items-center justify-between transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/30 overflow-hidden metric-card"
              style={{ minHeight: 100 }}
            >
              {/* Glow border animation */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none group-hover:animate-glow border-2 border-cyan-400/30 opacity-30"></div>
              {/* Icon with animated shine */}
              <div className={`mr-4 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-r ${metric.color} shadow-lg group-hover:animate-shine`}>
                <Icon className="w-6 h-6 text-white drop-shadow-lg" />
              </div>
              <div className="flex flex-col items-end flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                    {metric.value}
                  </span>
                  <span className={`flex items-center text-xs font-semibold ${metric.trend === 'up' ? 'text-green-400' : 'text-red-400'} transition-all`}>
                    <TrendingUp className={`w-3 h-3 mr-0.5 ${metric.trend === 'down' ? 'rotate-180' : ''}`} />
                    {metric.change}
                  </span>
                </div>
                <span className="text-xs text-cyan-200/80 tracking-wide uppercase font-medium mb-0.5">{metric.title}</span>
              </div>
            </div>
          );
        })}
        {/* My Assets card for non-admins */}
        {!isAdmin && (
          <div
            className="relative group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/20 shadow-lg rounded-2xl px-3 sm:px-4 py-4 sm:py-5 flex flex-row items-center justify-between transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/30 overflow-hidden metric-card"
            style={{ minHeight: 100 }}
          >
            <div className="absolute inset-0 rounded-2xl pointer-events-none group-hover:animate-glow border-2 border-cyan-400/30 opacity-30"></div>
            <div className={`mr-4 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg group-hover:animate-shine`}>
              <Package className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            <div className="flex flex-col items-end flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                  {assetCount}
                </span>
                <span className="flex items-center text-xs font-semibold text-green-400 transition-all">
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                  +0%
                </span>
              </div>
              <span className="text-xs text-cyan-200/80 tracking-wide uppercase font-medium mb-0.5">My Assets</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row - Only visible to admins */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="glass-morphism p-4 sm:p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Asset Growth</h3>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Bar dataKey="assets" fill="url(#assetGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-morphism p-4 sm:p-6 rounded-xl flex flex-col gap-4 lg:flex-row lg:gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Asset Status</h3>
                <Activity className="w-5 h-5 text-slate-400" />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-asset-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {statusData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-300">{item.name}</span>
                    <span className="text-sm text-slate-400">({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Ticket Status</h3>
                <Ticket className="w-5 h-5 text-slate-400" />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ticketStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ticketStatusData.map((entry, index) => (
                      <Cell key={`cell-ticket-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {ticketStatusData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-300">{item.name}</span>
                    <span className="text-sm text-slate-400">({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity and Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-3 glass-morphism p-4 sm:p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {recentActivity
              .filter(activity => isAdmin || activity.type === 'ticket' || activity.type === 'asset')
              .map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-start space-x-4 p-4 glass-morphism rounded-lg hover:bg-white/10 transition-colors">
                    <div className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center ${activity.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-white inline-block mr-2">{activity.action}</h4>
                          <span className="text-xs text-cyan-300/80 font-semibold">{activity.performedBy}</span>
                        </div>
                        <span className="text-xs text-slate-400">{activity.timestamp}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{activity.description}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;