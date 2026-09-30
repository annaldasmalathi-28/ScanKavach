/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  ScanLine,
  Layers,
  Network,
  MessageSquareText,
  HeartPulse,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import { APP_NAME, CLINICAL_DISCLAIMER } from '../config.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bank', label: 'Reference Bank', icon: Database },
    { to: '/analyze', label: 'Scan Screening', icon: ScanLine },
    { to: '/batch', label: 'Batch Triage', icon: Layers },
    { to: '/classifier', label: 'Condition Classifier', icon: Network },
    { to: '/assistant', label: 'AI Assistant', icon: MessageSquareText },
    { to: '/hub', label: 'Health Hub', icon: HeartPulse },
    { to: '/audit', label: 'Model Card & Audit', icon: FileSpreadsheet },
    { to: '/about', label: 'About & Self-Test', icon: Info },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-slate-800 bg-slate-950 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Brand header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5 sticky top-0 bg-slate-950 z-10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-inner">
                <ShieldCheck size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                  <span>{APP_NAME}</span>
                  <span className="text-[10px] uppercase font-mono px-1 rounded bg-teal-500/20 text-teal-300">
                    Kavach
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                  Clinical Shield
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="mt-3 space-y-0.5 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                    }`
                  }
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / Privacy & Disclaimer note */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-start gap-2 rounded-lg bg-slate-900/60 p-2.5 border border-slate-800">
            <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-tight">
              <span className="font-semibold text-slate-300">Kavach Shield Active: </span>
              Images never leave this device. Local browser execution.
            </div>
          </div>

          <p className="mt-2 text-[10px] text-slate-500 leading-tight text-center">
            {CLINICAL_DISCLAIMER}
          </p>
        </div>
      </aside>
    </>
  );
};
