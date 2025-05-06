'use client'

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { IconRefresh } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, MouseEvent } from 'react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ellipsify } from '@/utils/string-utils'
import { useCluster } from '../cluster/cluster-data-access'
import {
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useRequestAirdrop,
  useTransferSol,
} from './account-data-access'
import { useWallet } from '@getpara/react-sdk'

interface AccountProps {
  address: PublicKey;
}

export function AccountBalance({ address }: AccountProps) {
  const query = useGetBalance({ address })

  return (
    <div>
      <h1 className="text-5xl font-bold cursor-pointer" onClick={() => query.refetch()}>
        {query.data ? <BalanceSol balance={query.data} /> : '...'} SOL
      </h1>
    </div>
  )
}
export function AccountChecker() {
  const { data: wallet } = useWallet()
  const publicKey = wallet?.address ? new PublicKey(wallet.address) : null
  if (!publicKey) {
    return null
  }
  return <AccountBalanceCheck address={publicKey} />
}
export function AccountBalanceCheck({ address }: AccountProps) {
  const { cluster } = useCluster()
  const mutation = useRequestAirdrop({ address })
  const query = useGetBalance({ address })

  const handleAirdropClick = async (): Promise<void> => {
    try {
      await mutation.mutateAsync(1);
    } catch (err) {
      console.log(err);
    }
  }

  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <div className="alert alert-warning text-warning-content/80 rounded-none flex justify-center bold">
        <span>
          You have 0 SOL in this account. Click the button to request 1 SOL from the faucet. If it fails, ask us for SOL and we will send you some so you can demo the application. 
             </span>
        <button
          className="btn btn-xs btn-neutral"
          onClick={handleAirdropClick}
        >
          Request Airdrop
        </button>
      </div>
    )
  }
  return null
}

export function AccountButtons({ address }: AccountProps) {
  const { data: wallet } = useWallet()
  const { cluster } = useCluster()
  const [showAirdropModal, setShowAirdropModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)

  const handleShowAirdropModal = (): void => setShowAirdropModal(true);
  const handleShowSendModal = (): void => setShowSendModal(true);
  const handleShowReceiveModal = (): void => setShowReceiveModal(true);

  return (
    <div>
      <ModalAirdrop hide={() => setShowAirdropModal(false)} address={address} show={showAirdropModal} />
      <ModalReceive address={address} show={showReceiveModal} hide={() => setShowReceiveModal(false)} />
      <ModalSend address={address} show={showSendModal} hide={() => setShowSendModal(false)} />
      <div className="space-x-2">
        {/* <button
          disabled={cluster.network?.includes('mainnet')}
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={handleShowAirdropModal}
        >
          Airdrop
        </button> */}
        <button
          disabled={wallet?.address !== address.toString()}
          className="btn btn-xs lg:btn-md btn-outline"
          onClick={handleShowSendModal}
        >
          Send
        </button>
        <button className="btn btn-xs lg:btn-md btn-outline" onClick={handleShowReceiveModal}>
          Receive
        </button>
      </div>
    </div>
  )
}

export function AccountTokens({ address }: AccountProps) {
  const [showAll, setShowAll] = useState(false)
  const query = useGetTokenAccounts({ address })
  const client = useQueryClient()
  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  const toggleShowAll = (): void => setShowAll(!showAll);
  
  const handleRefresh = async (): Promise<void> => {
    await query.refetch()
    await client.invalidateQueries({
      queryKey: ['getTokenAccountBalance'],
    })
  };

  return (
    <div className="space-y-2">
      <div className="justify-between">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Token Accounts</h2>
          <div className="space-x-2">
            {query.isLoading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              <button
                className="btn btn-sm btn-outline"
                onClick={handleRefresh}
              >
                <IconRefresh size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {query.isError && <pre className="alert alert-error">Error: {query.error?.message.toString()}</pre>}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No token accounts found.</div>
          ) : (
            <table className="table border-4 rounded-lg border-separate border-base-300">
              <thead>
                <tr>
                  <th>Public Key</th>
                  <th>Mint</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {items?.map(({ account, pubkey }) => (
                  <tr key={pubkey.toString()}>
                    <td>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink label={ellipsify(pubkey.toString())} path={`account/${pubkey.toString()}`} />
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink
                            label={ellipsify(account.data.parsed.info.mint)}
                            path={`account/${account.data.parsed.info.mint.toString()}`}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="font-mono">{account.data.parsed.info.tokenAmount.uiAmount}</span>
                    </td>
                  </tr>
                ))}

                {(query.data?.length ?? 0) > 5 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      <button className="btn btn-xs btn-outline" onClick={toggleShowAll}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export function AccountTransactions({ address }: AccountProps) {
  const query = useGetSignatures({ address })
  const [showAll, setShowAll] = useState(false)

  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  const toggleShowAll = (): void => setShowAll(!showAll);
  
  const handleRefresh = async (): Promise<void> => {
    await query.refetch();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="space-x-2">
          {query.isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <button className="btn btn-sm btn-outline" onClick={handleRefresh}>
              <IconRefresh size={16} />
            </button>
          )}
        </div>
      </div>
      {query.isError && <pre className="alert alert-error">Error: {query.error?.message.toString()}</pre>}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No transactions found.</div>
          ) : (
            <table className="table border-4 rounded-lg border-separate border-base-300">
              <thead>
                <tr>
                  <th>Signature</th>
                  <th className="text-right">Slot</th>
                  <th>Block Time</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((item) => (
                  <tr key={item.signature}>
                    <th className="font-mono">
                      <ExplorerLink path={`tx/${item.signature}`} label={ellipsify(item.signature, 8)} />
                    </th>
                    <td className="font-mono text-right">
                      <ExplorerLink path={`block/${item.slot}`} label={item.slot.toString()} />
                    </td>
                    <td>{new Date((item.blockTime ?? 0) * 1000).toISOString()}</td>
                    <td className="text-right">
                      {item.err ? (
                        <div className="badge badge-error" title={JSON.stringify(item.err)}>
                          Failed
                        </div>
                      ) : (
                        <div className="badge badge-success">Success</div>
                      )}
                    </td>
                  </tr>
                ))}
                {(query.data?.length ?? 0) > 5 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      <button className="btn btn-xs btn-outline" onClick={toggleShowAll}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

interface BalanceProps {
  balance: number;
}

function BalanceSol({ balance }: BalanceProps) {
  return (balance / LAMPORTS_PER_SOL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

interface ModalProps {
  hide: () => void;
  show: boolean;
  address: PublicKey;
}

function ModalReceive({ hide, show, address }: ModalProps) {
  if (!show) return null
  return <div className="modal modal-open">...</div>
}

function ModalAirdrop({ hide, show, address }: ModalProps) {
  if (!show) return null
  const mutation = useRequestAirdrop({ address })
  return <div className="modal modal-open">...</div>
}

function ModalSend({ hide, show, address }: ModalProps) {
  if (!show) return null
  const mutation = useTransferSol({ address })
  return <div className="modal modal-open">...</div>
}
