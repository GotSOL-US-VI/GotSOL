import { cache } from 'react'
import { Connection, PublicKey } from "@solana/web3.js"
import { BorshCoder, Idl } from '@coral-xyz/anchor'
import idl from '@/utils/kumbaya.json'
import bs58 from 'bs58'
import { env } from "@/utils/env"

const connection = new Connection(
  env.isDevnet ? env.devnetHeliusRpcUrl : env.mainnetHeliusRpcUrl,
  "confirmed"
)

// This is a cached server function to fetch initial merchant data for SSR
export const getInitialServerMerchants = cache(async (walletAddress?: string) => {
  if (!walletAddress) return []
  
  try {
    const programId = new PublicKey(idl.address)
    
    const allAccounts = await connection.getProgramAccounts(
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
              bytes: walletAddress
            }
          }
        ]
      }
    )

    const merchantAccounts = await Promise.all(
      allAccounts.map(async ({ pubkey, account }) => {
        try {
          const coder = new BorshCoder(idl as Idl)
          const decoded = coder.accounts.decode('Merchant', account.data)

          return {
            publicKey: pubkey.toString(),
            account: {
              owner: decoded.owner.toString(),
              entityName: decoded.entity_name,
              total_withdrawn: decoded.total_withdrawn.toNumber(),
              total_refunded: decoded.total_refunded.toNumber(),
              merchant_bump: decoded.merchant_bump,
              is_active: decoded.is_active,
              refund_limit: decoded.refund_limit.toNumber()
            },
          }
        } catch (decodeError) {
          console.error(`Error decoding account ${pubkey.toString()}:`, decodeError)
          return null
        }
      })
    )

    const validMerchants = merchantAccounts
      .filter(m => m !== null)

    return validMerchants.sort((a, b) =>
      a.account.entityName.localeCompare(b.account.entityName)
    )
  } catch (error) {
    console.error('Error fetching merchants on server:', error)
    return [] // Always return an array even when there's an error
  }
}) 