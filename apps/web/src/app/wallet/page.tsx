'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { walletApi } from '@/lib/api';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number;
  price: number;
  popular?: boolean;
}

interface Transaction {
  id: string;
  type: 'CREDIT_PURCHASE' | 'ENTRY_FEE' | 'PRIZE_PAYOUT' | 'REFUND';
  amount: number;
  creditAmount: number;
  status: string;
  description?: string;
  createdAt: string;
  tournament?: {
    id: string;
    name: string;
    slug: string;
  };
}

function WalletContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number>(0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const creditsNeeded = searchParams.get('needed');
  const returnTo = searchParams.get('returnTo');
  const paymentResult = searchParams.get('payment');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      loadData();
    }
  }, [status, router]);

  const loadData = async () => {
    try {
      const [balanceRes, packagesRes, transactionsRes] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getCreditPackages(),
        walletApi.getTransactions({ pageSize: 20 }),
      ]);
      setBalance(balanceRes.data.balance);
      setPackages(packagesRes.data);
      setTransactions(transactionsRes.data.items || []);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId);
    try {
      const response = await walletApi.createCheckout(packageId);
      window.location.href = response.data.checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout:', error);
      setPurchasing(null);
    }
  };

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  const creditsToDollars = (credits: number) => {
    return (credits / 100).toFixed(2);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back to Tournament Link */}
      {returnTo && (
        <Link
          href={returnTo}
          className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tournament
        </Link>
      )}

      {/* Payment Result Banners */}
      {paymentResult === 'success' && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-green-400 font-medium">Payment Successful!</p>
            <p className="text-green-400/80 text-sm">Your credits have been added to your wallet.</p>
          </div>
        </div>
      )}

      {paymentResult === 'cancelled' && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-yellow-400 font-medium">Payment Cancelled</p>
            <p className="text-yellow-400/80 text-sm">Your payment was cancelled. No credits were added.</p>
          </div>
        </div>
      )}

      {/* Credits Needed Banner */}
      {creditsNeeded && (
        <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-primary-400" />
          <div>
            <p className="text-primary-400 font-medium">Additional Credits Needed</p>
            <p className="text-primary-400/80 text-sm">
              You need {formatCredits(parseInt(creditsNeeded))} more credits (${creditsToDollars(parseInt(creditsNeeded))}) to register for this tournament.
            </p>
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">My Wallet</h1>
            <p className="text-dark-400">Purchase credits to enter paid tournaments</p>
          </div>
          <div className="text-right">
            <p className="text-dark-400 text-sm mb-1">Current Balance</p>
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-3xl font-bold text-white">{formatCredits(balance)}</span>
              <span className="text-dark-400">credits</span>
            </div>
            <p className="text-dark-500 text-sm">(${creditsToDollars(balance)} value)</p>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Buy Credits</h2>
        <p className="text-dark-400 mb-6">100 credits = $1.00 | Use credits to enter paid tournaments and earn prizes</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`card relative ${
                pkg.popular ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Popular
                  </span>
                </div>
              )}

              <div className="text-center pt-2">
                <h3 className="text-lg font-semibold text-white mb-2">{pkg.name}</h3>
                <div className="mb-3">
                  <span className="text-3xl font-bold text-white">${pkg.price}</span>
                </div>
                <div className="text-dark-300 mb-1">
                  {formatCredits(pkg.credits)} credits
                </div>
                {pkg.bonus > 0 && (
                  <div className="text-green-400 text-sm font-medium">
                    +{formatCredits(pkg.bonus)} bonus!
                  </div>
                )}
                {pkg.bonus === 0 && (
                  <div className="text-dark-500 text-sm">&nbsp;</div>
                )}
                <div className="text-dark-500 text-xs mt-2 mb-4">
                  Total: {formatCredits(pkg.credits + pkg.bonus)} credits
                </div>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing !== null}
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    pkg.popular
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-dark-700 hover:bg-dark-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 inline mr-2" />
                      Purchase
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-6">Transaction History</h2>

        {transactions.length === 0 ? (
          <p className="text-dark-400 text-center py-8">No transactions yet. Purchase credits to get started!</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'PRIZE_PAYOUT' || tx.type === 'REFUND' || tx.type === 'CREDIT_PURCHASE'
                      ? 'bg-green-500/10'
                      : 'bg-red-500/10'
                  }`}>
                    {tx.type === 'CREDIT_PURCHASE' ? (
                      <CreditCard className="w-5 h-5 text-green-400" />
                    ) : tx.type === 'PRIZE_PAYOUT' || tx.type === 'REFUND' ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {tx.type === 'CREDIT_PURCHASE' && 'Credit Purchase'}
                      {tx.type === 'ENTRY_FEE' && 'Tournament Entry'}
                      {tx.type === 'PRIZE_PAYOUT' && 'Prize Payout'}
                      {tx.type === 'REFUND' && 'Refund'}
                    </p>
                    <p className="text-dark-400 text-sm">
                      {tx.tournament ? (
                        <Link
                          href={`/tournaments/${tx.tournament.slug}`}
                          className="hover:text-primary-400"
                        >
                          {tx.tournament.name}
                        </Link>
                      ) : (
                        tx.description
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${
                    tx.creditAmount >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {tx.creditAmount >= 0 ? '+' : ''}{formatCredits(tx.creditAmount)} credits
                  </p>
                  <p className="text-dark-500 text-xs">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <WalletContent />
    </Suspense>
  );
}
