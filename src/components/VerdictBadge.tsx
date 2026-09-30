/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: 'Normal' | 'Review' | 'Refer' | 'Rejected';
  borderline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showBorderlineBanner?: boolean;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  borderline = false,
  size = 'md',
  showBorderlineBanner = false,
}) => {
  const getBadgeStyle = () => {
    switch (verdict) {
      case 'Normal':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          icon: CheckCircle2,
          text: 'Normal',
        };
      case 'Review':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          icon: AlertTriangle,
          text: 'Review',
        };
      case 'Refer':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          icon: AlertCircle,
          text: 'Refer',
        };
      case 'Rejected':
      default:
        return {
          bg: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
          dot: 'bg-slate-400',
          icon: XCircle,
          text: 'Rejected',
        };
    }
  };

  const style = getBadgeStyle();
  const Icon = style.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 13,
    md: 15,
    lg: 18,
  }[size];

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div
        className={`inline-flex items-center rounded-md border font-medium tracking-wide ${style.bg} ${sizeClasses}`}
      >
        <Icon size={iconSizes} />
        <span>{style.text}</span>
        {borderline && !showBorderlineBanner && (
          <span className="ml-1 text-[10px] uppercase font-mono px-1 rounded bg-amber-400/20 text-amber-300">
            Borderline
          </span>
        )}
      </div>

      {borderline && showBorderlineBanner && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
          <AlertTriangle size={13} className="shrink-0" />
          <span>Borderline: needs human review</span>
        </div>
      )}
    </div>
  );
};
