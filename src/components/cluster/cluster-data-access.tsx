'use client'

import { clusterApiUrl, Connection } from '@solana/web3.js'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { createContext, ReactNode, useContext } from 'react'
import toast from 'react-hot-toast'
import { env } from '@/utils/env'

export interface Cluster {
  name: string
  endpoint: string
  network?: ClusterNetwork
  active?: boolean
}

export enum ClusterNetwork {
  Mainnet = 'mainnet-beta',
  Testnet = 'testnet',
  Devnet = 'devnet',
  Custom = 'custom',
}

// By default, we don't configure the mainnet-beta cluster
// The endpoint provided by clusterApiUrl('mainnet-beta') does not allow access from the browser due to CORS restrictions
// To use the mainnet-beta cluster, provide a custom endpoint
export const defaultClusters: Cluster[] = [
  {
    name: env.isDevnet ? 'devnet' : 'mainnet-beta',
    endpoint: env.devnetHeliusRpcUrl,
    network: env.isDevnet ? ClusterNetwork.Devnet : ClusterNetwork.Mainnet,
  },
  // { name: 'local', endpoint: 'http://localhost:8899' },
  // {
  //   name: 'testnet',
  //   endpoint: clusterApiUrl('testnet'),
  //   network: ClusterNetwork.Testnet,
  // },
]

// Ensure endpoint URL is valid
function validateEndpoint(url: string): string {
  try {
    // Remove any control characters and trim whitespace
    const sanitizedUrl = url.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    
    // If no protocol is specified, default to https://
    const urlWithProtocol = !sanitizedUrl.startsWith('http://') && !sanitizedUrl.startsWith('https://')
      ? `https://${sanitizedUrl}`
      : sanitizedUrl;

    // Validate URL format
    new URL(urlWithProtocol);
    return urlWithProtocol;
  } catch (error) {
    console.error('Invalid endpoint URL:', url, error);
    // Fall back to default devnet endpoint if URL is invalid
    return 'https://api.devnet.solana.com';
  }
}

// After initialization, update with Helius URL if available
if (typeof window !== 'undefined' && env.devnetHeliusRpcUrl) {
  defaultClusters[0].endpoint = validateEndpoint(env.devnetHeliusRpcUrl);
}

const clusterAtom = atomWithStorage<Cluster>('solana-cluster', defaultClusters[0])
const clustersAtom = atomWithStorage<Cluster[]>('solana-clusters', defaultClusters)

const activeClustersAtom = atom<Cluster[]>((get) => {
  const clusters = get(clustersAtom)
  const cluster = get(clusterAtom)
  return clusters.map((item) => ({
    ...item,
    endpoint: validateEndpoint(item.endpoint),
    active: item.name === cluster.name,
  }))
})

const activeClusterAtom = atom<Cluster>((get) => {
  const clusters = get(activeClustersAtom)
  const activeCluster = clusters.find((item) => item.active) || clusters[0]
  return {
    ...activeCluster,
    endpoint: validateEndpoint(activeCluster.endpoint)
  }
})

export interface ClusterProviderContext {
  cluster: Cluster
  clusters: Cluster[]
  addCluster: (cluster: Cluster) => void
  deleteCluster: (cluster: Cluster) => void
  setCluster: (cluster: Cluster) => void
  getExplorerUrl(path: string): string
}

const Context = createContext<ClusterProviderContext>({} as ClusterProviderContext)

export function ClusterProvider({ children }: { children: ReactNode }) {
  const cluster = useAtomValue(activeClusterAtom)
  const clusters = useAtomValue(activeClustersAtom)
  const setCluster = useSetAtom(clusterAtom)
  const setClusters = useSetAtom(clustersAtom)

  const value: ClusterProviderContext = {
    cluster,
    clusters: clusters.sort((a, b) => (a.name > b.name ? 1 : -1)),
    addCluster: (cluster: Cluster) => {
      try {
        const validatedEndpoint = validateEndpoint(cluster.endpoint);
        // Test the connection
        const connection = new Connection(validatedEndpoint);
        connection.getVersion()
          .then(() => {
            setClusters([...clusters, { ...cluster, endpoint: validatedEndpoint }]);
          })
          .catch((err: Error) => {
            console.error('Connection test failed:', err);
            toast.error(`Failed to connect to endpoint: ${err.message}`);
          });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        console.error('Cluster validation error:', error);
        toast.error(`Invalid endpoint: ${error.message}`);
      }
    },
    deleteCluster: (cluster: Cluster) => {
      setClusters(clusters.filter((item) => item.name !== cluster.name))
    },
    setCluster: (cluster: Cluster) => {
      try {
        const validatedEndpoint = validateEndpoint(cluster.endpoint);
        setCluster({ ...cluster, endpoint: validatedEndpoint });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        console.error('Error setting cluster:', error);
        toast.error(`Failed to set cluster: ${error.message}`);
      }
    },
    getExplorerUrl: (path: string) => `https://explorer.solana.com/${path}${getClusterUrlParam(cluster)}`,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCluster() {
  return useContext(Context)
}

function getClusterUrlParam(cluster: Cluster): string {
  let suffix = ''
  switch (cluster.network) {
    case ClusterNetwork.Devnet:
      suffix = 'devnet'
      break
    case ClusterNetwork.Mainnet:
      suffix = ''
      break
    case ClusterNetwork.Testnet:
      suffix = 'testnet'
      break
    default:
      suffix = `custom&customUrl=${encodeURIComponent(cluster.endpoint)}`
      break
  }

  return suffix.length ? `?cluster=${suffix}` : ''
}
