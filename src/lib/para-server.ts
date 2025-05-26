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

// Function to get the user's wallet information
export const getUserWalletInfo = async () => {
    try {
        const wallets = await paraServer.getWalletsByType("SOLANA");
        if (wallets.length === 0) {
            throw new Error("No Solana wallets found");
        }
        return wallets[0];
    } catch (error) {
        console.error("Error getting wallet info:", error);
        throw error;
    }
};

// Function to check if a wallet has sufficient balance
export const checkWalletBalance = async (publicKey: PublicKey): Promise<boolean> => {
    try {
        const balance = await connection.getBalance(publicKey);
        // Consider having sufficient balance if it's more than 0.1 SOL
        return balance > 100000000; // 0.1 SOL in lamports
    } catch (error) {
        console.error("Error checking wallet balance:", error);
        return false;
    }
}; 