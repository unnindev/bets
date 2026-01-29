'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Wallet } from '@/types';

interface WalletContextType {
  wallets: Wallet[];
  selectedWalletId: string;
  selectedWallet: Wallet | null;
  setSelectedWalletId: (id: string) => void;
  isLoading: boolean;
  reloadWallets: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const loadWallets = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('wallets').select('*').order('name');

    if (data && data.length > 0) {
      setWallets(data);

      // Recuperar carteira salva do localStorage ou usar a primeira
      const savedWalletId = localStorage.getItem('selectedWalletId');
      const validSavedWallet = savedWalletId && data.some(w => w.id === savedWalletId);

      if (validSavedWallet) {
        setSelectedWalletIdState(savedWalletId);
      } else {
        setSelectedWalletIdState(data[0].id);
        localStorage.setItem('selectedWalletId', data[0].id);
      }
    } else {
      setWallets([]);
      setSelectedWalletIdState('');
    }

    setIsLoading(false);
  };

  const setSelectedWalletId = (id: string) => {
    setSelectedWalletIdState(id);
    localStorage.setItem('selectedWalletId', id);
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const selectedWallet = wallets.find(w => w.id === selectedWalletId) || null;

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWalletId,
        selectedWallet,
        setSelectedWalletId,
        isLoading,
        reloadWallets: loadWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
