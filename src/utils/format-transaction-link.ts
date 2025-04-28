/**
 * Formats a transaction signature into a Solscan devnet link
 * @param signature The transaction signature to format
 * @returns The formatted Solscan devnet link
 */
export function formatSolscanDevnetLink(signature: string): string {
  if (!signature) {
    return '';
  }
  
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

/**
 * Formats multiple transaction signatures into Solscan devnet links
 * @param signatures Array of transaction signatures to format
 * @returns Array of formatted Solscan devnet links
 */
export function formatSolscanDevnetLinks(signatures: string[]): string[] {
  if (!signatures || signatures.length === 0) {
    return [];
  }
  
  return signatures.map(signature => formatSolscanDevnetLink(signature));
} 