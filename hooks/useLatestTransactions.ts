/**
 * useLatestTransactions Hook
 * 
 * Fetches and aggregates transactions from multiple networks.
 * Reusable hook for displaying latest transactions in home screen and token holdings.
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useTokenTransfers } from '@/queries/transactions';
import type { TransactionData } from '@/app/sections/wallet/components/ListItemTransaction';
import type { TokenTransfer } from '@/services/transactions/transactionHistoryService';
import { getCachedPrice } from '@/services/price/priceService';

export interface UseLatestTransactionsParams {
  /** Main wallet addresses by network */
  addresses?: Record<string, string | undefined>;
  /** Whether wallet is initialized */
  walletInitialized: boolean;
  /** Maximum number of transactions to return (default: 10) */
  limit?: number;
  /** Networks and tokens to fetch from */
  networkConfigs?: Array<{
    network: string;
    token: string;
    limit?: number;
  }>;
}

export interface UseLatestTransactionsReturn {
  /** Latest transactions aggregated from all networks */
  latestTransactions: TransactionData[];
  /** Function to find a TokenTransfer by hash and network */
  findTransferByHash: (hash: string, network: string) => TokenTransfer | undefined;
  /** All query objects for accessing raw data */
  queries: Array<{
    network: string;
    token: string;
    query: ReturnType<typeof useTokenTransfers>;
  }>;
}

/**
 * Default network configurations for fetching transactions
 */
const DEFAULT_NETWORK_CONFIGS: Array<{
  network: string;
  token: string;
  limit?: number;
}> = [
  { network: 'ethereum', token: 'usdt', limit: 10 },
  { network: 'polygon', token: 'usdt', limit: 10 },
  { network: 'arbitrum', token: 'usdt', limit: 10 },
  { network: 'spark', token: 'btc', limit: 10 },
];

/**
 * Transform TokenTransfer to TransactionData
 */
function transformTransferToTransactionData(
  transfer: TokenTransfer,
  walletAddress: string,
  network: string,
  tokenSymbol: string
): TransactionData {
  const walletAddressLower = walletAddress.toLowerCase();
  const isReceived = transfer.to.toLowerCase() === walletAddressLower;
  const isSent = transfer.from.toLowerCase() === walletAddressLower;
  
  const transactionType = isSent ? 'sent' : isReceived ? 'received' : 'received';
  
  const tokenAmount = parseFloat(transfer.value) || 0;
  const tokenPrice = getCachedPrice(tokenSymbol.toUpperCase() as any) || 1;
  const fiatAmount = tokenAmount * tokenPrice;

  return {
    type: transactionType,
    asset: tokenSymbol.toLowerCase(),
    amount: tokenAmount.toString(),
    fiatAmount: fiatAmount.toString(),
    ts: transfer.timestamp * 1000, // Convert to milliseconds
    txId: transfer.hash,
    network: network,
    tokenSymbol: tokenSymbol.toUpperCase(),
  };
}

/**
 * Hook to fetch and aggregate latest transactions from multiple networks
 */
export function useLatestTransactions({
  addresses,
  walletInitialized,
  limit = 10,
  networkConfigs = DEFAULT_NETWORK_CONFIGS,
}: UseLatestTransactionsParams): UseLatestTransactionsReturn {
  // Memoize network configs
  const stableNetworkConfigs = useMemo(() => networkConfigs, [
    JSON.stringify(networkConfigs.map(c => `${c.network}-${c.token}-${c.limit || 10}`))
  ]);

  // Check if we have a single custom config (for token holdings view)
  const isCustomConfig = stableNetworkConfigs.length === 1 && 
    !DEFAULT_NETWORK_CONFIGS.some(d => 
      d.network === stableNetworkConfigs[0].network && d.token === stableNetworkConfigs[0].token
    );
  
  const customConfig = isCustomConfig ? stableNetworkConfigs[0] : null;
  
  // Create individual queries for each network config
  // Since hooks can't be called in loops, we handle common cases explicitly
  // For custom single configs, we create a dedicated query
  const customQuery = useTokenTransfers(
    customConfig?.network || '',
    customConfig?.token || '',
    customConfig ? (addresses?.[customConfig.network] || '') : '',
    { limit: customConfig?.limit || 10 },
    !!customConfig && !!addresses?.[customConfig.network] && walletInitialized
  );
  
  // Find ethereum config
  const ethereumConfig = stableNetworkConfigs.find(c => c.network === 'ethereum' && c.token === 'usdt');
  const ethereumQuery = useTokenTransfers(
    'ethereum',
    'usdt',
    addresses?.ethereum || '',
    { limit: ethereumConfig?.limit || 10 },
    !!addresses?.ethereum && walletInitialized && !!ethereumConfig && !isCustomConfig
  );
  
  // Find polygon config
  const polygonConfig = stableNetworkConfigs.find(c => c.network === 'polygon' && c.token === 'usdt');
  const polygonQuery = useTokenTransfers(
    'polygon',
    'usdt',
    addresses?.polygon || '',
    { limit: polygonConfig?.limit || 10 },
    !!addresses?.polygon && walletInitialized && !!polygonConfig && !isCustomConfig
  );
  
  // Find arbitrum config
  const arbitrumConfig = stableNetworkConfigs.find(c => c.network === 'arbitrum' && c.token === 'usdt');
  const arbitrumQuery = useTokenTransfers(
    'arbitrum',
    'usdt',
    addresses?.arbitrum || '',
    { limit: arbitrumConfig?.limit || 10 },
    !!addresses?.arbitrum && walletInitialized && !!arbitrumConfig && !isCustomConfig
  );
  
  // Find spark config
  const sparkConfig = stableNetworkConfigs.find(c => c.network === 'spark' && c.token === 'btc');
  const sparkQuery = useTokenTransfers(
    'spark',
    'btc',
    addresses?.spark || '',
    { limit: sparkConfig?.limit || 10 },
    !!addresses?.spark && walletInitialized && !!sparkConfig && !isCustomConfig
  );

  // Map queries to their configs
  const queries = useMemo(() => {
    return stableNetworkConfigs.map(({ network, token }) => {
      let query;
      if (isCustomConfig && customConfig) {
        query = customQuery;
      } else if (network === 'ethereum' && token === 'usdt') {
        query = ethereumQuery;
      } else if (network === 'polygon' && token === 'usdt') {
        query = polygonQuery;
      } else if (network === 'arbitrum' && token === 'usdt') {
        query = arbitrumQuery;
      } else if (network === 'spark' && token === 'btc') {
        query = sparkQuery;
      } else {
        // Fallback to ethereum query (shouldn't happen in practice)
        query = ethereumQuery;
      }
      
      return {
        network,
        token,
        query,
      };
    });
  }, [stableNetworkConfigs, isCustomConfig, customConfig, customQuery, ethereumQuery, polygonQuery, arbitrumQuery, sparkQuery]);

  // Get all query data for dependency tracking
  const queryDataArray = useMemo(() => {
    return queries.map(q => q.query.data);
  }, [queries]);

  // Transform and aggregate transactions
  const latestTransactions = useMemo(() => {
    const allTransactions: TransactionData[] = [];
    
    queries.forEach(({ network, token, query }) => {
      const address = addresses?.[network];
      if (!address || !query.data || !Array.isArray(query.data)) {
        return;
      }

      const transfers = query.data
        .map((transfer) => transformTransferToTransactionData(transfer, address, network, token))
        .filter((tx) => {
          // Avoid duplicates by hash
          return !allTransactions.some((existingTx) => existingTx.txId === tx.txId);
        });
      
      allTransactions.push(...transfers);
    });

    // Sort by timestamp (newest first) and limit
    return allTransactions
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }, [queries, queryDataArray, addresses, limit]);

  // Use ref to store queries for stable access in callback
  const queriesRef = useRef(queries);
  useEffect(() => {
    queriesRef.current = queries;
  }, [queries]);

  // Function to find a transfer by hash and network
  // Access queries from ref at call time to avoid dependency issues
  const findTransferByHash = useCallback((hash: string, network: string): TokenTransfer | undefined => {
    // Find the matching query config from ref
    const queryConfig = queriesRef.current.find(q => q.network === network);
    if (!queryConfig?.query.data || !Array.isArray(queryConfig.query.data)) {
      return undefined;
    }
    
    return queryConfig.query.data.find(t => t.hash === hash);
  }, []); // Empty deps - uses ref for current queries

  return {
    latestTransactions,
    findTransferByHash,
    queries,
  };
}
