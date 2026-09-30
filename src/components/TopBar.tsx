/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Moon, Sun, UserCheck, Languages } from 'lucide-react';
import { getCurrentSession, logoutUser, UserSession } from '../lib/auth.ts';
import { applyTheme, getInitialTheme, Theme } from '../lib/theme.ts';
import { getLanguage, setLanguage, SupportedLanguage } from '../lib/i18n.ts';
import { ModelStatusPills } from './ModelStatus.tsx';
import { MemoryBankData } from '../lib/memoryBank.ts';

interface TopBarProps {
  title: string;
  onToggleSidebar?: () => void;
  bank?: MemoryBankData | null;
}

export const TopBar: React.FC<TopBarProps> = ({ title, onToggleSidebar, bank }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(getCurrentSession());
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [currentLang, setCurrentLangState] = useState<SupportedLanguage>(getLanguage());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setCurrentLangState(lang);
  };

  const handleSignOut = () => {
    logoutUser();
    setSession(null);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
          aria-label="Open navigation sidebar"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-base font-semibold text-slate-100 sm:text-lg tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Model and Bank status indicators */}
        <div className="hidden md:flex">
          <ModelStatusPills bank={bank} />
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs">
          <Languages size={14} className="text-teal-400 shrink-0" />
          <select
            value={currentLang}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            className="bg-transparent text-slate-300 font-mono text-[11px] focus:outline-hidden cursor-pointer"
            aria-label="Select language"
          >
            <option value="en" className="bg-slate-900 text-slate-200">EN</option>
            <option value="hi" className="bg-slate-900 text-slate-200">HI (हिंदी)</option>
            <option value="es" className="bg-slate-900 text-slate-200">ES</option>
            <option value="fr" className="bg-slate-900 text-slate-200">FR</option>
          </select>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* User Profile Pill & Sign Out */}
        {session && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600/30 text-teal-300 font-semibold text-xs border border-teal-500/30">
                {session.name
                  ? session.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'DR'}
              </div>

              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-medium text-slate-200 leading-tight">
                  {session.name}
                </span>
                <span className="text-[10px] text-teal-400 flex items-center gap-1">
                  <UserCheck size={10} />
                  <span>{session.role}</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-colors"
              title="Sign out of ScanKavach session"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
