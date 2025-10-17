import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Ticket, 
  Shield, 
  Settings,
  Menu,
  Database,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Define all menu items
  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'employee'] },
    { icon: Package, label: 'Assets', path: '/assets', roles: ['admin', 'employee'] },
    { icon: Shield, label: 'Credentials', path: '/credentials', roles: ['admin'] },
    { icon: Ticket, label: 'Tickets', path: '/tickets', roles: ['admin', 'employee'] },
    { icon: Users, label: 'Users', path: '/users', roles: ['admin'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin', 'employee'] },
  ];

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => 
    item.roles.includes(user?.role || 'employee')
  );

  // Responsive sidebar: hidden on mobile, drawer if mobileOpen
  return (
    <>
      {/* Overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <div
        className={`fixed left-0 top-0 h-full glass-morphism border-r border-white/10 transition-all duration-300 z-50
          ${collapsed ? 'w-20' : 'w-64'}
          hidden md:block
        `}
      >
        {/* Desktop sidebar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">IT ZYZTEM</h1>
                <p className="text-xs text-slate-400">
                  {isAdmin ? 'Admin Portal' : 'Employee Portal'}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200"
          >
            <Menu className={`${collapsed ? 'w-10 h-10' : 'w-8 h-8'} transition-all duration-200`} />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0.2 top-0.2 bottom-0.2 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full"></div>
                )}
                <Icon className={`${collapsed ? 'w-12 h-12' : 'w-5 h-5'} transition-all duration-200 ${isActive ? 'text-cyan-300' : ''}`} />
                {!collapsed && (
                  <span className="font-medium transition-colors">{item.label}</span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="glass-morphism p-4 rounded-xl">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {user?.fullname || 'User'}
                  </p>
                  <p className="text-xs text-green-400">
                    {isAdmin ? 'Administrator' : 'Employee'}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full w-4/5"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Mobile drawer sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-full max-w-xs glass-morphism border-r border-white/10 transition-transform duration-300 z-50 md:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ boxShadow: mobileOpen ? '0 0 0 9999px rgba(0,0,0,0.4)' : 'none' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">IT ZYZTEM</h1>
              <p className="text-xs text-slate-400">
                {isAdmin ? 'Admin Portal' : 'Employee Portal'}
              </p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200"
          >
            <Menu className="w-8 h-8" />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={onMobileClose}
              >
                {isActive && (
                  <div className="absolute left-0.2 top-0.2 bottom-0.2 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full"></div>
                )}
                <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'text-cyan-300' : ''}`} />
                <span className="font-medium transition-colors">{item.label}</span>
                {isActive && (
                  <div className="ml-auto">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="glass-morphism p-4 rounded-xl">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {user?.fullname || 'User'}
                </p>
                <p className="text-xs text-green-400">
                  {isAdmin ? 'Administrator' : 'Employee'}
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full w-4/5"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;