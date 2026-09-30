/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getCurrentSession,
  getRateLimitStatus,
  loginDemoUser,
  loginUser,
  registerUser,
  UserRole,
} from '../lib/auth.ts';
import {
  APP_NAME,
  APP_LOGIN_TAGLINE,
  CLINICAL_DISCLAIMER,
} from '../config.ts';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Clinician');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (getCurrentSession()) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);

  // Rate limit countdown timer
  useEffect(() => {
    const status = getRateLimitStatus();
    if (status.isLocked) {
      setRateLimitSeconds(status.remainingSeconds);
    }

    const interval = setInterval(() => {
      const s = getRateLimitStatus();
      if (s.isLocked) {
        setRateLimitSeconds(s.remainingSeconds);
      } else {
        setRateLimitSeconds(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rateLimitSeconds > 0) {
      setError(`Too many failed attempts. Please wait ${rateLimitSeconds}s.`);
      return;
    }

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await loginUser(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid clinical or academic email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await registerUser(name, email, password, role);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    loginDemoUser();
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100 font-sans">
      {/* Brand Left Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between border-r border-slate-800 bg-linear-to-b from-slate-950 via-slate-900 to-teal-950/30 p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-lg shadow-teal-950/50">
              <ShieldCheck size={26} />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>{APP_NAME}</span>
                <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-mono text-teal-300">
                  Kavach Shield
                </span>
              </span>
              <p className="text-xs text-slate-400">{APP_LOGIN_TAGLINE}</p>
            </div>
          </div>

          {/* Hero Tagline */}
          <div className="mt-16 max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300 border border-teal-500/20 mb-4">
              <Sparkles size={12} />
              <span>Label-Free Anomaly Screening</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl leading-tight">
              {APP_LOGIN_TAGLINE}
            </h2>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Trained purely on normal scans without disease labels. ScanKavach acts as a clinical shield, flagging subtle outliers and atypical patterns while ensuring medical images never leave your local device.
            </p>
          </div>

          {/* Key clinical features bullet list */}
          <div className="mt-10 space-y-3.5 max-w-md text-xs text-slate-300">
            <div className="flex items-start gap-3 rounded-lg bg-slate-900/60 p-3 border border-slate-800">
              <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100">Zero Patient Data Leakage: </strong>
                All inferences and memory bank computations run 100% locally in your browser.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-slate-900/60 p-3 border border-slate-800">
              <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100">Automated Quality Safety Gate: </strong>
                Rejects colour photos, blur, and low-contrast images before model scoring.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-slate-900/60 p-3 border border-slate-800">
              <Shield size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100">Decision Support &amp; Nearest Healthy Match: </strong>
                Side-by-side comparison with closest healthy scans and optional pattern suggestions.
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer footer */}
        <div className="border-t border-slate-800/80 pt-6 text-[11px] text-slate-500">
          <p>{CLINICAL_DISCLAIMER}</p>
        </div>
      </div>

      {/* Auth Form Right Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Logo Header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="text-lg font-bold text-white">{APP_NAME}</span>
              <p className="text-xs text-slate-400">{APP_LOGIN_TAGLINE}</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === 'signin'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === 'register'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create account
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Rate Limit Banner */}
            {rateLimitSeconds > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 p-3 text-xs text-amber-300">
                <Lock size={15} className="shrink-0 text-amber-400" />
                <span>Too many failed sign-ins. Unlocking in {rateLimitSeconds}s.</span>
              </div>
            )}

            {/* Sign In Form */}
            {tab === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="clinician@hospital.org"
                    required
                    disabled={isLoading || rateLimitSeconds > 0}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading || rateLimitSeconds > 0}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || rateLimitSeconds > 0}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors shadow-lg shadow-teal-900/30"
                >
                  <span>{isLoading ? 'Verifying...' : 'Sign in'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              /* Registration Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Jordan Hayes"
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Clinical / Institutional Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="j.hayes@medcenter.edu"
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="Clinician">Clinician</option>
                    <option value="Radiology Technician">Radiology Technician</option>
                    <option value="Student/Researcher">Student / Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password (min 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      disabled={isLoading}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors shadow-lg shadow-teal-900/30"
                >
                  <span>{isLoading ? 'Creating account...' : 'Create account'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* Quick Demo Sign In Button */}
            <div className="mt-5 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 py-2.5 text-xs sm:text-sm font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors"
              >
                <UserCheck size={16} />
                <span>Continue as demo user (Dr. Alex Morgan)</span>
              </button>
            </div>

            {/* Privacy honest note */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
              <Info size={12} className="text-teal-400 shrink-0" />
              <span>Accounts are stored on this device only (demo authentication).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
