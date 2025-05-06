import ParaServer, { Environment } from "@getpara/server-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "@/utils/env";

// Initialize the Para Server SDK
const paraServer = new ParaServer(Environment.BETA, process.env.PARA_SERVER_API_KEY || "");

// Initialize the connection
const connection = new Connection(
    env.isDevnet ? env.devnetHeliusRpcUrl : env.mainnetHeliusRpcUrl,
    "confirmed"
);

// Function to get the fee payer's public key
export const getFeePayerPublicKey = async (): Promise<PublicKey> => {
    try {
        const wallets = await paraServer.getWalletsByType("SOLANA");
        if (wallets.length === 0 || !wallets[0].address) {
            throw new Error("No Solana wallets found for fee payer");
        }
        return new PublicKey(wallets[0].address);
    } catch (error) {
        console.error("Error getting fee payer public key:", error);
        throw error;
    }
};

// Function to sign a transaction with the fee payer
export const signTransactionWithFeePayer = async (transaction: Buffer): Promise<Buffer> => {
    try {
        const wallets = await paraServer.getWalletsByType("SOLANA");
        if (wallets.length === 0 || !wallets[0].id) {
            throw new Error("No Solana wallets found for fee payer");
        }

        const signedTransaction = await paraServer.signTransaction({
            walletId: wallets[0].id,
            rlpEncodedTxBase64: transaction.toString('base64'),
            chainId: "SOLANA",
        });

        if ('signature' in signedTransaction) {
            return Buffer.from(signedTransaction.signature, 'base64');
        } else {
            throw new Error("Transaction signing failed");
        }
    } catch (error) {
        console.error("Error signing transaction with fee payer:", error);
        throw error;
    }
};

// Function to sign multiple transactions with the fee payer
export const signAllTransactionsWithFeePayer = async (transactions: Buffer[]): Promise<Buffer[]> => {
    try {
        const wallets = await paraServer.getWalletsByType("SOLANA");
        if (wallets.length === 0 || !wallets[0].id) {
            throw new Error("No Solana wallets found for fee payer");
        }

        const signedTransactions = await Promise.all(
            transactions.map(tx => paraServer.signTransaction({
                walletId: wallets[0].id,
                rlpEncodedTxBase64: tx.toString('base64'),
                chainId: "SOLANA",
            }))
        );

        return signedTransactions.map(tx => {
            if ('signature' in tx) {
                return Buffer.from(tx.signature, 'base64');
            } else {
                throw new Error("Transaction signing failed");
            }
        });
    } catch (error) {
        console.error("Error signing multiple transactions with fee payer:", error);
        throw error;
    }
};

// Function to check if the fee payer has sufficient balance
export const checkFeePayerBalance = async (): Promise<boolean> => {
    try {
        const feePayerPubkey = await getFeePayerPublicKey();
        const balance = await connection.getBalance(feePayerPubkey);
        // Consider having sufficient balance if it's more than 0.1 SOL
        return balance > 100000000; // 0.1 SOL in lamports
    } catch (error) {
        console.error("Error checking fee payer balance:", error);
        return false;
    }
};

// Function to get the fee payer's wallet information
export const getFeePayerWalletInfo = async () => {
    try {
        const wallets = await paraServer.getWalletsByType("SOLANA");
        if (wallets.length === 0) {
            throw new Error("No Solana wallets found for fee payer");
        }
        return wallets[0];
    } catch (error) {
        console.error("Error getting fee payer wallet info:", error);
        throw error;
    }
}; 