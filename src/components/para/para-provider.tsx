"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ParaModal, AuthLayout, OAuthMethod } from "@getpara/react-sdk";
import { ParaSolanaWeb3Signer } from "@getpara/solana-web3.js-v1-integration";
import { ConnectionContext } from "@/lib/connection-context";
import { para } from "@/utils/para";
import { env } from "@/utils/env";
import "@getpara/react-sdk/styles.css";
import { Connection, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useConnection } from '@/lib/connection-context';

interface ParaContextType {
    isConnected: boolean;
    address: string | null;
    walletId: string | null;
    email: string | null; // <- add this
    isLoading: boolean;
    error: string | null;
    openModal: () => void;
    closeModal: () => void;
    signer: ParaSolanaWeb3Signer | null;
    connection: Connection | null;
    anchorProvider: anchor.AnchorProvider | null;
}

const ParaContext = createContext<ParaContextType | undefined>(undefined);

export function ParaProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [walletId, setWalletId] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signer, setSigner] = useState<ParaSolanaWeb3Signer | null>(null);
    const [anchorProvider, setAnchorProvider] = useState<anchor.AnchorProvider | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
    const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 2000; // 2 seconds initial delay

    const { connection } = useConnection(); 
    useEffect(() => {
        if (connection) {
            if (signer && signer.sender) {
                const signingWallet = {
                    publicKey: signer.sender,
                    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
                        let attempts = 0;
                        const maxAttempts = 3;
                        const delayMs = 1000;

                        while (attempts < maxAttempts) {
                            try {
                                return await signer.signTransaction(tx);
                            } catch (error) {
                                attempts++;
                                if (attempts === maxAttempts) {
                                    throw error;
                                }
                                // Wait before retrying
                                await new Promise(resolve => setTimeout(resolve, delayMs));
                            }
                        }
                        throw new Error('Failed to sign transaction after multiple attempts');
                    },
                    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
                        return await Promise.all(txs.map((tx) => signingWallet.signTransaction(tx)));
                    },
                };
                const provider = new anchor.AnchorProvider(connection, signingWallet, {
                    commitment: connection.commitment || "confirmed",
                });
                setAnchorProvider(provider);
            } else {
                const readOnlyWallet = {
                    publicKey: SystemProgram.programId, // Fallback to SystemProgram's public key for read-only access
                    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
                        throw new Error("Read-only provider: Authenticate to sign transactions.");
                    },
                    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
                        throw new Error("Read-only provider: Authenticate to sign transactions.");
                    },
                };
                const provider = new anchor.AnchorProvider(connection, readOnlyWallet, {
                    commitment: connection.commitment || "confirmed",
                });
                setAnchorProvider(provider);
            }
        } else {
            setAnchorProvider(null);
        }
    }, [connection, signer]);

    const checkAuthentication = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Debug API key being used
            const apiKey = process.env.NEXT_PUBLIC_PARA_API_KEY;
            console.log("Para API Key during authentication:", apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "Not set");
            
            const isAuthenticated = await para.isFullyLoggedIn();
            setIsConnected(isAuthenticated);
            if (isAuthenticated) {
                const userEmail = await para.getEmail();
                setEmail(userEmail || null);
                
                // Try to get user information
                try {
                    // Get user ID as a fallback
                    const userId = await para.getUserId();
                    console.log("Para User ID:", userId);
                    
                    // Try to get user data from available methods
                    let displayName = null;
                    
                    // Try to get email first
                    if (userEmail) {
                        displayName = userEmail;
                    }
                    
                    // If we have a user ID but no email, use that
                    if (!displayName && userId) {
                        displayName = `User ${userId.substring(0, 8)}...`;
                    }
                    
                    // If we still don't have a display name, use a default
                    if (!displayName) {
                        displayName = 'Connected User';
                    }
                    
                    setUserDisplayName(displayName);
                } catch (userErr) {
                    console.error("Error fetching user information:", userErr);
                    // Fallback to email or default
                    setUserDisplayName(userEmail || 'Connected User');
                }
                
                const wallets = await para.getWalletsByType("SOLANA");
                if (wallets.length > 0 && wallets[0].address) {
                    setAddress(wallets[0].address);
                    setWalletId(wallets[0].id || null);
                    
                    // Initialize signer inside the callback
                    if (connection) {
                        try {
                            // Check if we need to reinitialize the signer
                            if (!signer || !signer.sender) {
                                console.log("Initializing new Para signer");
                                const paraSigner = new ParaSolanaWeb3Signer(para, connection);
                                // Verify the signer is properly initialized
                                if (!paraSigner || !paraSigner.sender) {
                                    throw new Error("Failed to initialize Para signer: Invalid signer state");
                                }
                                setSigner(paraSigner);
                            } else {
                                console.log("Using existing Para signer");
                            }
                        } catch (error) {
                            setError(`Failed to initialize signer: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            console.error("Cannot initialize signer:", error);
                        }
                    } else {
                        setError("Failed to initialize signer: Connection not ready.");
                        console.error("Cannot initialize signer: Connection not available.");
                    }
                } else {
                    // Authenticated but no SOLANA wallet found
                    setAddress(null);
                    setWalletId(null);
                    setSigner(null); // Clear signer directly
                    setError("Authenticated, but no Solana wallet found in Para account.");
                }
            } else {
                // Not authenticated
                setAddress(null);
                setWalletId(null);
                setEmail(null);
                setUserDisplayName(null);
                setSigner(null); // Clear signer directly
            }
        } catch (err: any) {
            setError(err.message || "An error occurred during authentication");
            setIsConnected(false);
            setAddress(null);
            setWalletId(null);
            setEmail(null);
            setUserDisplayName(null);
            setSigner(null); // Clear signer directly
        }
        setIsLoading(false);
    }, [connection, signer]);

    // Add a periodic check to ensure the signer is still valid
    useEffect(() => {
        if (isConnected && signer) {
            const intervalId = setInterval(async () => {
                try {
                    // Simple check to see if the signer is still valid
                    if (signer && signer.sender) {
                        // Try to get the address to verify the signer is still working
                        const address = signer.sender.toString();
                        if (!address) {
                            console.warn("Signer appears to be invalid, reinitializing...");
                            setSigner(null); // Clear the invalid signer
                            await checkAuthentication(); // Reinitialize
                        }
                    }
                } catch (error) {
                    console.error("Error checking signer status:", error);
                    setSigner(null); // Clear the invalid signer
                    await checkAuthentication(); // Reinitialize
                }
            }, 30000); // Check every 30 seconds
            
            return () => clearInterval(intervalId);
        }
    }, [isConnected, signer, checkAuthentication]);

    const getReconnectDelay = useCallback(() => {
        return Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
    }, [reconnectAttempts]);

    const ensureConnection = useCallback(async () => {
        if (wsStatus === 'connected') {
            try {
                // Verify connection is still alive
                await para.isFullyLoggedIn();
                return true;
            } catch (error) {
                console.warn("Connection check failed:", error);
                setWsStatus('disconnected');
            }
        }

        if (reconnectAttempts >= maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            setError("Connection lost. Please try again later.");
            return false;
        }

        const delay = getReconnectDelay();
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        
        setWsStatus('connecting');
        setReconnectAttempts(prev => prev + 1);
        
        try {
            await new Promise(resolve => setTimeout(resolve, delay));
            setSigner(null);
            await checkAuthentication();
            return true;
        } catch (error) {
            console.error("Reconnection failed:", error);
            return false;
        }
    }, [wsStatus, reconnectAttempts, getReconnectDelay, checkAuthentication, para]);

    const checkWsConnection = useCallback(async () => {
        if (!signer || !signer.sender) {
            setWsStatus('disconnected');
            return;
        }

        try {
            // More thorough WebSocket connection check
            const address = signer.sender.toString();
            if (!address) {
                throw new Error('Invalid signer state');
            }

            // Test the connection with a simple operation
            await para.isFullyLoggedIn();
            setWsStatus('connected');
            setReconnectAttempts(0); // Reset reconnect attempts on successful connection
        } catch (error) {
            console.error("WebSocket connection error:", error);
            setWsStatus('disconnected');
            await ensureConnection();
        }
    }, [signer, para, ensureConnection]);

    useEffect(() => {
        checkAuthentication();
    }, [checkAuthentication]);

    const openModal = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeModalCallback = useCallback(async () => {
        setIsOpen(false);
        await checkAuthentication();
    }, [checkAuthentication]);

    // Enhanced transaction signing with better error handling
    const signTransaction = useCallback(async (transaction: Transaction) => {
        if (!signer) {
            throw new Error("Signer not initialized");
        }

        // Ensure we have a valid connection before attempting to sign
        const isConnected = await ensureConnection();
        if (!isConnected) {
            throw new Error("Unable to establish stable connection");
        }

        // Debug signer information
        console.log("Signer details:", {
            sender: signer.sender ? signer.sender.toString() : "No sender",
            userId: await para.getUserId(),
            walletId: walletId
        });

        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check if signer is still valid
                if (!signer.sender) {
                    throw new Error("Signer is no longer valid");
                }

                // Add a small delay between retries
                if (attempt > 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between retries
                }

                console.log(`Attempting to sign transaction (attempt ${attempt}/${maxRetries})`);
                const signedTx = await signer.signTransaction(transaction);
                return signedTx;
            } catch (error) {
                lastError = error as Error;
                console.error(`Signing attempt ${attempt} failed:`, error);
                
                // Log more details about the error
                if (error instanceof Error) {
                    console.error("Error details:", {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    });
                }
                
                // If it's a WebSocket error, try to reconnect
                if (error instanceof Error && 
                    (error.message.includes('WebSocket') || 
                     error.message.includes('connection') || 
                     error.message.includes('timeout'))) {
                    setWsStatus('disconnected');
                    setSigner(null);
                    const reconnected = await ensureConnection();
                    if (!reconnected) {
                        throw new Error("Failed to establish stable connection for signing");
                    }
                }
            }
        }

        throw lastError || new Error("Failed to sign transaction after multiple attempts");
    }, [signer, ensureConnection, para, walletId]);

    const signAllTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!signer) {
            throw new Error("Signer not initialized");
        }

        const signedTransactions: Transaction[] = [];
        const errors: Error[] = [];

        for (const transaction of transactions) {
            try {
                const signedTx = await signTransaction(transaction);
                signedTransactions.push(signedTx);
            } catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }

        if (errors.length > 0) {
            throw new Error(`Failed to sign some transactions: ${errors.map(e => e.message).join(", ")}`);
        }

        return signedTransactions;
    }, [signer, signTransaction]);

    return (
        <ConnectionContext.Provider value={{ connection }}>
            <ParaContext.Provider
                value={{
                    isConnected,
                    address,
                    walletId,
                    email,
                    isLoading,
                    error,
                    openModal,
                    closeModal: closeModalCallback,
                    signer,
                    connection,
                    anchorProvider,
                }}>
                {children}
                <ParaModal
                    para={para}
                    isOpen={isOpen}
                    onClose={closeModalCallback}
                    disableEmailLogin={false}
                    disablePhoneLogin={false}
                    authLayout={[AuthLayout.AUTH_FULL]}
                    oAuthMethods={[
                        OAuthMethod.GOOGLE,
                        OAuthMethod.TWITTER,
                        OAuthMethod.APPLE,
                        OAuthMethod.DISCORD,
                        OAuthMethod.FACEBOOK,
                        OAuthMethod.TELEGRAM,
                    ]}
                    onRampTestMode={true}
                    theme={{
                        foregroundColor: "#2D3648",
                        backgroundColor: "#FFFFFF",
                        accentColor: "#0066CC",
                        darkForegroundColor: "#E8EBF2",
                        darkBackgroundColor: "#1A1F2B",
                        darkAccentColor: "#4D9FFF",
                        mode: "light",
                        borderRadius: "none",
                        font: "Inter",
                    }}
                    appName="GotSOL"
                    // logo="/para.svg"
                    recoverySecretStepEnabled={true}
                    twoFactorAuthEnabled={false}
                />
            </ParaContext.Provider>
        </ConnectionContext.Provider>
    );
}

export function usePara() {
    const context = useContext(ParaContext);
    if (context === undefined) {
        throw new Error("usePara must be used within a ParaProvider");
    }
    return context;
}
export function useAnchorProvider() {
    const context = usePara();
    return context.anchorProvider;
}
