import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { LayoutDashboard, Trash2, Layers, Archive, Settings, ShieldAlert, Cpu } from 'lucide-react';

export default function Sidebar() {
  const developerMode = useAppStore((state) => state.developerMode);
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/cleaner', name: 'Interactive Cleaner', icon: Trash2 },
    { path: '/dev-cleaner', name: 'Developer Cleaner', icon: Layers },
    { path: '/settings', name: 'Settings & Privacy', icon: Settings },
  ];

  return (
    <div className="w-64 bg-brand-dark border-r border-brand-border flex flex-col justify-between flex-shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-brand-border space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-brand-accent flex items-center justify-center premium-glow-subtle flex-shrink-0">
            <Cpu className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-gray-100">SafeSweep</h1>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Production Utility</span>
          </div>
        </div>
      </div>

      {/* Sidebar Menu Items */}
      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all border ${isActive
                  ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/25'
                  : 'text-gray-400 hover:bg-brand-card hover:text-white border-transparent'
                }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-brand-border space-y-2">
        {developerMode && (
          <div className="bg-brand-rose/10 border border-brand-rose/25 text-brand-rose rounded-lg px-3 py-2 flex items-center gap-2 text-[10px] font-semibold tracking-wide uppercase">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>Dev Override active</span>
          </div>
        )}
        <div className="text-[9px] text-gray-500 font-mono text-center">
          v1.0.0 (Windows Offline API)
        </div>
      </div>
    </div>
  );
}
