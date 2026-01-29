'use client';

import { Sidebar } from './Sidebar';
import { WalletProvider } from '@/contexts/WalletContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-950">
        <Sidebar />
        <main className="lg:pl-64 pt-16 lg:pt-0">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </WalletProvider>
  );
}
