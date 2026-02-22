'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  LogOut,
  TrendingUp,
  Menu,
  X,
  Settings,
  ChevronDown,
  Check,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { formatCurrency } from '@/lib/constants';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bets', label: 'Apostas', icon: Receipt },
  { href: '/palpites', label: 'Destaques', icon: Lightbulb },
  { href: '/analytics', label: 'Análises', icon: BarChart3 },
  { href: '/wallets', label: 'Carteiras', icon: Wallet },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { wallets, selectedWalletId, selectedWallet, setSelectedWalletId, isLoading } = useWallet();

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWalletDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    setWalletDropdownOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">BetTracker</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-40
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">BetTracker</span>
        </div>

        {/* Mobile spacer */}
        <div className="lg:hidden h-16" />

        {/* Wallet Selector */}
        {wallets.length > 0 && (
          <div className="px-3 py-3 border-b border-gray-800" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wallet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-xs text-gray-400">Carteira</p>
                    <p className="text-sm font-medium text-white truncate">
                      {isLoading ? 'Carregando...' : selectedWallet?.name || 'Selecione'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedWallet && (
                    <span className={`text-xs font-medium ${Number(selectedWallet.balance) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(selectedWallet.balance)}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${walletDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown */}
              {walletDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleWalletSelect(wallet.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-700 transition ${
                        wallet.id === selectedWalletId ? 'bg-gray-700/50' : ''
                      }`}
                    >
                      <span className="text-sm text-white truncate">{wallet.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${Number(wallet.balance) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(wallet.balance)}
                        </span>
                        {wallet.id === selectedWalletId && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition
                      ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
