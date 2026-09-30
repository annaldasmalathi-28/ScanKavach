/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentSession } from '../lib/auth.ts';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const session = getCurrentSession();
  const location = useLocation();

  if (!session) {
    // Preserve requested route for seamless return after authentication
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
