import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../../utils/kumbaya.json';

export async function migrateMerchant(
    program: Program,
    oldMerchantPubkey: PublicKey,
) {
    try {
        // Fetch old merchant data
        const oldMerchant = await (program.account as any).merchant.fetch(oldMerchantPubkey);
        
        // Create new merchant with same name but new account structure
        await program.methods
            .createMerchant(oldMerchant.entityName)
            .accounts({
                owner: oldMerchant.owner,
                usdcMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC mint
                tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // Token program ID
            })
            .rpc();

        // Optional: Close old account to recover rent
        // This requires adding a close instruction to your program
        // await program.methods
        //     .closeMerchantAccount()
        //     .accounts({
        //         merchant: oldMerchantPubkey,
        //         owner: oldMerchant.owner,
        //     })
        //     .rpc();

        return true;
    } catch (error) {
        console.error('Error migrating merchant:', error);
        throw error;
    }
} 