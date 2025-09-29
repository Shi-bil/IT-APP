import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // For mobile drawer

  // Responsive margin: 0 on mobile, 16 on sm, 64 on md+
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex overflow-x-hidden">
      {/* Sidebar: hidden on mobile, shown as drawer if open */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 min-w-0 ${
        sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      }`}> 
        <Header 
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
          onMobileMenu={() => setSidebarOpen(true)}
        />
        <main className="p-2 sm:p-4 md:p-6 max-w-full w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;