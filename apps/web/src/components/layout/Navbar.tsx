'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { Menu, X, Trophy, Users, Gamepad2, User, LogOut, Plus, Shield, Wallet } from 'lucide-react';
import { NotificationDropdown } from '../notifications/NotificationDropdown';

export function Navbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Tournaments', href: '/tournaments', icon: Trophy },
    { name: 'Games', href: '/games', icon: Gamepad2 },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  ];

  return (
    <nav className="bg-dark-900/80 backdrop-blur-md border-b border-dark-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">GameArena</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-dark-700 animate-pulse" />
            ) : session ? (
              <>
                <Link href="/tournaments/create" className="btn-primary text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </Link>
                <NotificationDropdown />
                <div className="relative group">
                  <button className="flex items-center gap-2 p-2 hover:bg-dark-800 rounded-lg transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white text-sm">{session.user?.name}</span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors rounded-t-lg"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      href="/wallet"
                      className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors"
                    >
                      <Wallet className="w-4 h-4" />
                      Wallet
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors w-full rounded-b-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="btn-outline text-sm">
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-dark-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-800 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <div className="border-t border-dark-800 mt-4 pt-4">
              {session ? (
                <>
                  <Link
                    href="/tournaments/create"
                    className="flex items-center gap-2 px-4 py-3 text-primary-400 hover:bg-dark-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Plus className="w-5 h-5" />
                    Create Tournament
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </Link>
                  <Link
                    href="/wallet"
                    className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Wallet className="w-5 h-5" />
                    Wallet
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-3 px-4">
                  <Link href="/auth/login" className="btn-outline flex-1 text-center">
                    Sign In
                  </Link>
                  <Link href="/auth/register" className="btn-primary flex-1 text-center">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
