/**
 * useSendTransaction Hook
 * 
 * Handles transaction sending logic including:
 * - Fee estimation
 * - Amount conversion
 * - Transaction execution
 */

import { useCallback, useState } from 'react';
import { useRumbleStore } from '@/stores/rumbleStore';
import { useRumbleWallet } from '@/hooks/useRumbleWallet';
import { getTokenAddress } from '@/config/tokens';
import { validateAddressForNetwork, isValidLightningInvoice } from '@/utils/validation/addressValidation';
import { createLogger } from '@/utils/logger';
import type { RumbleAddressBook } from '@/api/types/channels';

const logger = createLogger('hooks/useSendTransaction');

export interface UseSendTransactionParams {
  selectedNetwork: string;
  selectedToken: string;
  accountIndex: number;
  tokenBalance: {
    amount: number;
    decimals: number;
  };
}

export interface FeeEstimationResult {
  feeInUSD: number;
  feeInToken: number;
  failed: boolean;
}

export function useSendTransaction(params: UseSendTransactionParams) {
  const { selectedNetwork, selectedToken, accountIndex, tokenBalance } = params;
  const rumbleStore = useRumbleStore();
  const { getWalletAddress, callAccountMethod } = useRumbleWallet();
  const [estimatedFees, setEstimatedFees] = useState<number>(0);
  const [estimatedFeesToken, setEstimatedFeesToken] = useState<number>(0);
  const [feeEstimationFailed, setFeeEstimationFailed] = useState<boolean>(false);

  /**
   * Estimate transaction fees
   */
  const estimateFees = useCallback(async (
    recipientAddress: string | null,
    recipientCreator: RumbleAddressBook | null,
    tokenAmount: string,
    tokenPrice: number | null
  ): Promise<FeeEstimationResult> => {
    // Skip if no recipient or invalid amount
    if (!recipientAddress && !recipientCreator) {
      setEstimatedFees(0);
      setEstimatedFeesToken(0);
      setFeeEstimationFailed(false);
      return { feeInUSD: 0, feeInToken: 0, failed: false };
    }

    const finalAmountToken = parseFloat(tokenAmount) || 0;
    if (finalAmountToken <= 0) {
      setEstimatedFees(0);
      setEstimatedFeesToken(0);
      setFeeEstimationFailed(false);
      return { feeInUSD: 0, feeInToken: 0, failed: false };
    }

    try {
      // Get recipient address
      let actualRecipientAddress: string;
      if (recipientAddress) {
        actualRecipientAddress = recipientAddress;
      } else if (recipientCreator) {
        // For creators, try to get their wallet address
        const creatorWallet = rumbleStore.getWalletByIdentifier(recipientCreator.id);
        if (!creatorWallet) {
          setEstimatedFees(0);
          setEstimatedFeesToken(0);
          setFeeEstimationFailed(false);
          return { feeInUSD: 0, feeInToken: 0, failed: false };
        }
        const address = await getWalletAddress(creatorWallet.accountIndex, selectedNetwork);
        if (!address) {
          setEstimatedFees(0);
          setEstimatedFeesToken(0);
          setFeeEstimationFailed(false);
          return { feeInUSD: 0, feeInToken: 0, failed: false };
        }
        actualRecipientAddress = address;
      } else {
        setEstimatedFees(0);
        setEstimatedFeesToken(0);
        setFeeEstimationFailed(false);
        return { feeInUSD: 0, feeInToken: 0, failed: false };
      }

      // Check if this is a Lightning invoice
      const isLightningInvoice = isValidLightningInvoice(actualRecipientAddress);
      
      if (isLightningInvoice) {
        // For Lightning invoices, use quotePayLightningInvoice on spark network
        const quoteResult = await callAccountMethod<{ fee: number }>(
          'spark',
          accountIndex,
          'quotePayLightningInvoice',
          {
            invoice: actualRecipientAddress,
          }
        );

        // Extract fee from response
        const feeInRawUnits = quoteResult?.fee || 0;
        
        // Convert fee from raw format (smallest units) to token units
        const feeInTokenUnits = feeInRawUnits / Math.pow(10, tokenBalance.decimals);
        
        // Convert fee to USD using token price
        const feeInUSD = feeInTokenUnits * (tokenPrice || 0);

        setEstimatedFeesToken(feeInTokenUnits);
        setEstimatedFees(feeInUSD);
        setFeeEstimationFailed(false);
        
        return { feeInUSD, feeInToken: feeInTokenUnits, failed: false };
      }

      // Validate recipient address before calling quoteTransfer
      if (!validateAddressForNetwork(actualRecipientAddress, selectedNetwork, selectedToken)) {
        logger.warn('Invalid recipient address for fee estimation', { address: actualRecipientAddress });
        setEstimatedFees(0);
        setEstimatedFeesToken(0);
        setFeeEstimationFailed(false);
        return { feeInUSD: 0, feeInToken: 0, failed: false };
      }

      // Convert token symbol to token address (null for native tokens, contract address for ERC20)
      const tokenAddress = getTokenAddress(selectedNetwork, selectedToken);
      const tokenParam = tokenAddress !== null ? tokenAddress : (selectedToken.startsWith('0x') ? selectedToken : null);

      // Convert token amount to smallest units
      const amountInSmallestUnits = Math.floor(finalAmountToken * Math.pow(10, tokenBalance.decimals));

      // Call quoteTransfer to get fee estimation
      const quoteResult = await callAccountMethod<{ fee: number }>(
        selectedNetwork,
        accountIndex,
        'quoteTransfer',
        {
          token: tokenParam,
          recipient: actualRecipientAddress,
          amount: amountInSmallestUnits,
        }
      );

      // Extract fee from response
      // Fee is in the same currency as the token being sent, in raw format (smallest units)
      const feeInRawUnits = quoteResult?.fee || 0;
      
      // Convert fee from raw format (smallest units) to token units
      // Raw format means we need to divide by 10^decimals to get token units
      const feeInTokenUnits = feeInRawUnits / Math.pow(10, tokenBalance.decimals);
      
      // Convert fee to USD using token price
      const feeInUSD = feeInTokenUnits * (tokenPrice || 0);

      setEstimatedFeesToken(feeInTokenUnits);
      setEstimatedFees(feeInUSD);
      setFeeEstimationFailed(false);
      
      return { feeInUSD, feeInToken: feeInTokenUnits, failed: false };
    } catch (error) {
      logger.error('Failed to fetch fee estimation', error);
      setEstimatedFees(0);
      setEstimatedFeesToken(0);
      setFeeEstimationFailed(true);
      return { feeInUSD: 0, feeInToken: 0, failed: true };
    }
  }, [
    selectedNetwork,
    accountIndex,
    selectedToken,
    tokenBalance.decimals,
    rumbleStore,
    getWalletAddress,
    callAccountMethod,
  ]);

  /**
   * Execute transaction
   */
  const executeTransaction = useCallback(async (
    recipientAddress: string | null,
    recipientCreator: RumbleAddressBook | null,
    tokenAmount: string,
    getWalletAddressFn: (accountIndex: number, network: string) => Promise<string | null>
  ): Promise<{ transactionId: string; hash: string; fee: number }> => {
    // Get recipient address
    let actualRecipientAddress: string;
    if (recipientAddress) {
      actualRecipientAddress = recipientAddress;
    } else if (recipientCreator) {
      const creatorWallet = rumbleStore.getWalletByIdentifier(recipientCreator.id);
      if (creatorWallet) {
        const address = await getWalletAddressFn(creatorWallet.accountIndex, selectedNetwork);
        if (!address) {
          throw new Error('Failed to get creator wallet address');
        }
        actualRecipientAddress = address;
      } else {
        throw new Error('Creator wallet address not found. Please use address input instead.');
      }
    } else {
      throw new Error('No recipient selected');
    }

    // Convert amount to proper format (token amount in smallest units)
    const finalAmountToken = parseFloat(tokenAmount) || 0;
    const amountInSmallestUnits = Math.floor(finalAmountToken * Math.pow(10, tokenBalance.decimals));

    // Check if this is a Lightning invoice - if so, use payLightningInvoice on spark network
    const isLightningInvoice = isValidLightningInvoice(actualRecipientAddress);
    
    if (isLightningInvoice) {
      // For Lightning invoices, use payLightningInvoice on spark network
      // Lightning invoices are paid from the spark network balance
      const payResult = await callAccountMethod<{ hash: string; fee: number }>(
        'spark',
        accountIndex,
        'payLightningInvoice',
        {
          invoice: actualRecipientAddress,
        },
      );

      // Extract hash and fee from payment result
      const hash = payResult?.hash || '';
      const feeInRawUnits = payResult?.fee || 0;
      
      // Convert fee from raw format (smallest units) to token units
      const feeInTokenUnits = feeInRawUnits / Math.pow(10, tokenBalance.decimals);
      
      // Generate transactionId from hash
      const transactionId = hash.length > 12 ? hash.substring(0, 12) : hash;

      logger.debug('Lightning invoice paid', {
        hash,
        invoice: actualRecipientAddress.substring(0, 50) + '...',
      });

      return {
        transactionId,
        hash,
        fee: feeInTokenUnits,
      };
    }

    // Regular transfer for non-Lightning transactions
    // Convert token symbol to token address
    const tokenAddress = getTokenAddress(selectedNetwork, selectedToken);
    const tokenParam = tokenAddress !== null ? tokenAddress : (selectedToken.startsWith('0x') ? selectedToken : null);

      // Call transfer method on worklet
      const transferResult = await callAccountMethod<{ hash: string; fee: number }>(
        selectedNetwork,
        accountIndex,
        'transfer',
        {
          token: tokenParam,
          recipient: actualRecipientAddress,
          amount: amountInSmallestUnits,
          transferMaxFee: 50000, // Max 50,000 paymaster token units
        },
      );

    // Extract hash and fee from transfer result
    const hash = transferResult?.hash || '';
    const feeInRawUnits = transferResult?.fee || 0;
    
    // Convert fee from raw format (smallest units) to token units
    const feeInTokenUnits = feeInRawUnits / Math.pow(10, tokenBalance.decimals);
    
    // Generate transactionId from hash (first 12 characters, or full hash if shorter)
    const transactionId = hash.length > 12 ? hash.substring(0, 12) : hash;

    return {
      transactionId,
      hash,
      fee: feeInTokenUnits,
    };
  }, [
    selectedNetwork,
    accountIndex,
    selectedToken,
    tokenBalance.decimals,
    rumbleStore,
    callAccountMethod,
  ]);

  return {
    estimatedFees,
    estimatedFeesToken,
    feeEstimationFailed,
    estimateFees,
    executeTransaction,
  };
}

