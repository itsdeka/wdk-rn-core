/**
 * useHomeDataTransformation Hook
 * 
 * Handles data transformation logic for the home screen.
 * Transforms aggregated balances to currencies, calculates display balances,
 * and transforms tip jars with balances.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ImageSourcePropType } from 'react-native';
import type { RumbleWallet } from '@/stores/rumbleStore';
import { WalletDark, TipJarDark } from '@/assets/images';
import { CurrencyData, TransactionData } from '@/app/sections/wallet/components';
import {
  aggregatedBalancesToCurrencyData,
  getTotalBalanceFromAggregated,
  getTipJarBalancesFromAggregated,
} from '@/utils/home/homeBalanceUtils';
import { formatBalance } from '@/utils/formatting/balanceFormatter';
import type { AggregatedBalances } from '@/hooks/useAggregatedBalances';
import { getPendingTransactions, type OngoingTransaction } from '@/services/transactions/ongoingTransactionsStorage';
// Caching is now handled at the service level (balanceAggregationService)

interface UseHomeDataTransformationParams {
  allTipJars: RumbleWallet[];
  mainWallet: RumbleWallet | null;
  aggregatedBalances: AggregatedBalances;
  selectedBalanceView: string | undefined;
}

interface UseHomeDataTransformationReturn {
  jarsWithTotalBalance: Array<{
    id: string;
    accountIndex: number;
    name: string;
    totalFiatBalance: string | number | { value?: string | number };
  }>;
  selectedJar: {
    accountIndex: number;
    name: string;
    identifier: string;
  } | undefined;
  currencies: CurrencyData[];
  totalBalance: number;
  displayBalance: string;
  balanceSubtitle: string;
  balanceIllustrationSource: ImageSourcePropType;
  primaryWalletAddress: string | undefined;
  latestTransactions: TransactionData[];
  pendingTransactions: Array<{ id: string }>;
}

/**
 * Hook to transform data for home screen display
 */
export function useHomeDataTransformation({
  allTipJars,
  mainWallet,
  aggregatedBalances,
  selectedBalanceView,
}: UseHomeDataTransformationParams): UseHomeDataTransformationReturn {
  const { t } = useTranslation();
  const router = useRouter();

  // Get primary wallet address (default to Ethereum)
  const primaryWalletAddress = useMemo(() => {
    if (!mainWallet?.addresses) {
      return undefined;
    }

    // Try to get Ethereum address first, fallback to first available address
    const address = mainWallet.addresses['ethereum'] ||
      mainWallet.addresses['polygon'] ||
      mainWallet.addresses['arbitrum'] ||
      mainWallet.addresses['plasma'] ||
      Object.values(mainWallet.addresses)[0];

    return address;
  }, [mainWallet]);

  // Transform tip jars to match expected format with balances from aggregated data
  const jarsWithTotalBalance = useMemo(() => {
    const tipJarsWithData = allTipJars.map((jar) => ({
      identifier: jar.identifier,
      name: jar.name || (jar.type === 'unrelated'
        ? t('HOME_SCREEN.UNRELATED_WALLET')
        : t('HOME_SCREEN.TIP_JAR_WITH_NUMBER', { number: jar.accountIndex })),
    }));

    const balances = getTipJarBalancesFromAggregated(aggregatedBalances, tipJarsWithData);

    return balances.map((balance, index) => {
      // getTipJarBalancesFromAggregated always returns { value: number }
      const rawBalance = typeof balance.totalFiatBalance === 'object'
        ? balance.totalFiatBalance.value
        : balance.totalFiatBalance;
      
      // Ensure currentBalance is always a number
      const currentBalance: number = typeof rawBalance === 'number'
        ? rawBalance
        : (typeof rawBalance === 'string' ? parseFloat(rawBalance) || 0 : 0);

      // Preserve the original format (object with value property)
      // Caching is handled at the service level, so we just use the balance as-is
      return {
        id: balance.id,
        accountIndex: allTipJars[index]?.accountIndex, // Keep accountIndex for wallet operations
        name: balance.name,
        totalFiatBalance: { value: currentBalance },
      };
    });
  }, [allTipJars, aggregatedBalances, t]);

  // Determine selected jar
  const selectedJar = useMemo(() => {
    if (selectedBalanceView === 'total' || !selectedBalanceView) {
      return undefined;
    }
    const jar = jarsWithTotalBalance.find((jar) => String(jar.id) === selectedBalanceView);
    if (!jar) {
      return undefined;
    }
    // Find the corresponding tip jar to get the identifier
    const tipJar = allTipJars.find((tj) => tj.identifier === jar.id);
    return {
      accountIndex: jar.accountIndex,
      name: jar.name,
      identifier: tipJar?.identifier || jar.id,
    };
  }, [selectedBalanceView, jarsWithTotalBalance, allTipJars]);

  // Helper to get wallet identifier from selected balance view
  const getWalletIdentifierForView = useCallback(() => {
    if (selectedBalanceView === 'total' || !selectedBalanceView) {
      return undefined;
    }
    if (selectedJar) {
      return selectedJar.identifier;
    }
    return mainWallet?.identifier;
  }, [selectedBalanceView, selectedJar, mainWallet]);

  // Transform aggregated balances to CurrencyData format
  // Caching is handled at the service level, so we just use the balances as-is
  const currencies: CurrencyData[] = useMemo(() => {
    const walletIdentifier = getWalletIdentifierForView();

    return aggregatedBalancesToCurrencyData(
      aggregatedBalances,
      walletIdentifier,
      t,
      (symbol) => {
        router.push(`/sections/(authenticated)/token/${symbol}`);
      }
    );
  }, [aggregatedBalances, getWalletIdentifierForView, t, router]);
  
  // Calculate total balance from aggregated balances
  // Caching is handled at the service level, so we just use the balance as-is
  const totalBalance = useMemo(() => {
    const walletIdentifier = getWalletIdentifierForView();
    return getTotalBalanceFromAggregated(aggregatedBalances, walletIdentifier);
  }, [aggregatedBalances, getWalletIdentifierForView]);

  // Prepare transactions data (empty for now)
  const latestTransactions: TransactionData[] = useMemo(() => {
    // TODO: Fetch from transactions API when available
    return [];
  }, []);

  // Load pending transactions from storage
  const [pendingTransactions, setPendingTransactions] = useState<Array<{ id: string }>>([]);
  
  useEffect(() => {
    // Load pending transactions on mount and when data changes
    const loadPendingTransactions = () => {
      const pending = getPendingTransactions();
      setPendingTransactions(pending.map(tx => ({ id: tx.id })));
    };
    
    loadPendingTransactions();
    
    // Set up interval to refresh pending transactions periodically
    const interval = setInterval(loadPendingTransactions, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Calculate display balance based on selection
  const displayBalance = useMemo(() => {
    // totalBalance already accounts for selectedBalanceView, so just format it
    return formatBalance(totalBalance);
  }, [totalBalance]);

  // Determine balance subtitle
  const balanceSubtitle = useMemo(() => {
    if (selectedBalanceView === 'total') {
      return t('HOME_SCREEN.TOTAL_BALANCE');
    }
    if (selectedJar) {
      return selectedJar.name;
    }
    return mainWallet?.name || t('HOME_SCREEN.WALLET');
  }, [selectedBalanceView, selectedJar, mainWallet, t]);

  // Determine illustration source
  const balanceIllustrationSource = useMemo(() => {
    const isJarSelected = !!selectedJar;
    return isJarSelected ? TipJarDark : WalletDark;
  }, [selectedJar]);

  return {
    jarsWithTotalBalance,
    selectedJar,
    currencies,
    totalBalance,
    displayBalance,
    balanceSubtitle,
    balanceIllustrationSource,
    primaryWalletAddress,
    latestTransactions,
    pendingTransactions,
  };
}

