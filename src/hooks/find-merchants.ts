'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, Idl } from '@coral-xyz/anchor';
import idl from '@/utils/kumbaya.json';
import bs58 from 'bs58';

export interface MerchantAccount {
  owner: PublicKey;
  entityName: string;
  total_withdrawn: number;
  total_refunded: number;
  merchant_bump: number;
  is_active: boolean;
  refund_limit: number;
}

export interface Merchant {
  publicKey: PublicKey;
  account: MerchantAccount;
}

export function useMerchants(walletAddress?: string, connection?: any) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  
  // Store wallet and connection in refs to break dependency cycle
  const walletRef = useRef(walletAddress);
  const connectionRef = useRef(connection);
  const idlAddressRef = useRef(idl.address);
  
  // Update refs when props change
  useEffect(() => {
    walletRef.current = walletAddress;
    connectionRef.current = connection;
  }, [walletAddress, connection]);

  // Only fetch once per wallet/connection combination
  const fetchMerchants = useCallback(async () => {
    if (!walletRef.current || !connectionRef.current) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const programId = new PublicKey(idlAddressRef.current);
      
      const allAccounts = await connectionRef.current.getProgramAccounts(
        programId,
        {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(Buffer.from([71, 235, 30, 40, 231, 21, 32, 64]))
              }
            },
            {
              memcmp: {
                offset: 8,
                bytes: walletRef.current
              }
            }
          ]
        }
      );

      if (!mountedRef.current) return;

      const merchantAccounts = await Promise.all(
        allAccounts.map(async ({ pubkey, account }: any) => {
          try {
            const coder = new BorshCoder(idl as Idl);
            const decoded = coder.accounts.decode('Merchant', account.data);

            return {
              publicKey: new PublicKey(pubkey),
              account: {
                owner: decoded.owner,
                entityName: decoded.entity_name,
                total_withdrawn: decoded.total_withdrawn.toNumber(),
                total_refunded: decoded.total_refunded.toNumber(),
                merchant_bump: decoded.merchant_bump,
                is_active: decoded.is_active,
                refund_limit: decoded.refund_limit.toNumber()
              },
            };
          } catch (decodeError) {
            console.error(`Error decoding account ${pubkey.toString()}:`, decodeError);
            return null;
          }
        })
      );

      if (!mountedRef.current) return;

      const validMerchants = merchantAccounts
        .filter((m: Merchant | null): m is Merchant => m !== null)
        .filter((m: Merchant) => m.account.is_active); // Only show active merchants

      const sortedMerchants = validMerchants.sort((a: Merchant, b: Merchant) =>
        a.account.entityName.localeCompare(b.account.entityName)
      );

      setMerchants(sortedMerchants);
      setError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Error fetching merchants:', error);
      setError('Failed to fetch merchants. Please try again later.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // Empty dependency array prevents recreation of this function

  useEffect(() => {
    mountedRef.current = true;
    
    fetchMerchants();
    
    return () => {
      mountedRef.current = false;
    };
  }, [walletAddress, connection, fetchMerchants]); // Only re-run when wallet or connection changes

  return { merchants, loading, error };
} 