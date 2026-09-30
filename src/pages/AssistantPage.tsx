/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { AssistantContext } from '../lib/assistant.ts';
import { getActiveBank, loadBankFromDb, MemoryBankData } from '../lib/memoryBank.ts';

export const AssistantPage: React.FC = () => {
  const location = useLocation();
  const [bank, setBank] = useState<MemoryBankData | null>(getActiveBank());
  const initialContext = (location.state as { context?: AssistantContext })?.context;

  useEffect(() => {
    async function init() {
      const b = await loadBankFromDb();
      setBank(b);
    }
    init();
  }, []);

  return (
    <AppShell title="AI Clinical Screening Assistant" bank={bank}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            Screening Assistant
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Ask questions about anomaly scores, borderline thresholds, blur gates, and reference set sizing.
          </p>
        </div>

        <ChatPanel initialContext={initialContext} heightClass="h-[640px]" />
      </div>
    </AppShell>
  );
};
