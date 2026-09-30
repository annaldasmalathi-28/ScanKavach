/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Cpu, Database, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  getModelStatus,
  ModelLoadingState,
  retryLoadModel,
  subscribeModelStatus,
} from '../lib/extractor.ts';
import { getActiveBank, MemoryBankData } from '../lib/memoryBank.ts';

interface ModelStatusProps {
  bank?: MemoryBankData | null;
}

export const ModelStatusPills: React.FC<ModelStatusProps> = ({ bank }) => {
  const [modelState, setModelState] = useState<ModelLoadingState>(getModelStatus());
  const [isRetrying, setIsRetrying] = useState(false);
  const activeBank = bank !== undefined ? bank : getActiveBank();

  useEffect(() => {
    const unsubscribe = subscribeModelStatus((state) => {
      setModelState(state);
    });
    return unsubscribe;
  }, []);

  const handleRetry = async () => {
    try {
      setIsRetrying(true);
      await retryLoadModel();
    } catch {
      // Handled in subscriber
    } finally {
      setIsRetrying(false);
    }
  };

  // Model Pill rendering
  const renderModelPill = () => {
    switch (modelState.status) {
      case 'ready':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Extractor Ready</span>
          </div>
        );
      case 'loading':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium">
            <Loader2 size={13} className="animate-spin text-teal-400" />
            <span>Loading Backbone ({modelState.progress}%)</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
            <AlertCircle size={13} className="text-rose-400" />
            <span>Extractor Error</span>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-white text-[10px]"
            >
              <RefreshCw size={10} className={isRetrying ? 'animate-spin' : ''} />
              <span>Retry</span>
            </button>
          </div>
        );
      case 'unloaded':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
            <Cpu size={13} />
            <span>Model Standby</span>
          </div>
        );
    }
  };

  // Bank Pill rendering
  const renderBankPill = () => {
    if (activeBank && activeBank.healthyScanCount > 0) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium">
          <Database size={13} className="text-teal-400" />
          <span>Bank: {activeBank.healthyScanCount} Scans</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
        <Database size={13} className="text-amber-400" />
        <span>No Reference Bank</span>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {renderModelPill()}
      {renderBankPill()}
    </div>
  );
};
