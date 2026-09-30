/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { BankPage } from './pages/BankPage.tsx';
import { AnalyzePage } from './pages/AnalyzePage.tsx';
import { AssistantPage } from './pages/AssistantPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { BatchPage } from './pages/BatchPage.tsx';
import { ClassifierPage } from './pages/ClassifierPage.tsx';
import { HealthHubPage } from './pages/HealthHubPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { loadExtractorModel } from './lib/extractor.ts';
import { getInitialTheme, applyTheme } from './lib/theme.ts';

export default function App() {
  useEffect(() => {
    // 1. Initialize light/dark theme
    const theme = getInitialTheme();
    applyTheme(theme);

    // 2. Load model lazily AFTER the first screen has rendered
    // (Login page must appear instantly with zero blocking scripts)
    const timer = setTimeout(() => {
      loadExtractorModel().catch((err) => {
        console.warn('Background model preloading deferred or failed:', err);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bank"
          element={
            <ProtectedRoute>
              <BankPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analyze"
          element={
            <ProtectedRoute>
              <AnalyzePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/batch"
          element={
            <ProtectedRoute>
              <BatchPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/classifier"
          element={
            <ProtectedRoute>
              <ClassifierPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hub"
          element={
            <ProtectedRoute>
              <HealthHubPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/about"
          element={
            <ProtectedRoute>
              <AboutPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback unknown routes to root dashboard or login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
