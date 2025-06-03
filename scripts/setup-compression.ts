import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import { 
  createAllocTreeInstruction,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@solana/spl-account-compression';
import { getConcurrentMerkleTreeAccountSize } from '@solana/spl-account-compression';

// Import your program IDL
import idl from '../src/utils/gotsol.json';

interface CompressionConfig {
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth: number;
}

export class CompressionManager {
  private program: Program;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: Wallet, programId: PublicKey) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(idl as Idl, programId, this.provider);
  }

  /**
   * Calculate the required size and cost for a Merkle tree
   */
  calculateTreeCost(config: CompressionConfig): { size: number; costSOL: number } {
    const size = getConcurrentMerkleTreeAccountSize(
      config.maxDepth,
      config.maxBufferSize,
      config.canopyDepth
    );
    const costSOL = (size * this.connection.getMinimumBalanceForRentExemption) / LAMPORTS_PER_SOL;
    return { size, costSOL };
  }

  /**
   * Create and initialize a new Merkle tree for compressed storage
   */
  async createMerkleTree(
    config: CompressionConfig,
    payer: Keypair
  ): Promise<{ 
    merkleTree: PublicKey; 
    treeAuthority: PublicKey; 
    signature: string 
  }> {
    // Generate a new keypair for the tree
    const merkleTree = Keypair.generate();
    
    // Find the tree authority PDA
    const [treeAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('tree_authority')],
      this.program.programId
    );

    // Calculate space needed
    const space = getConcurrentMerkleTreeAccountSize(
      config.maxDepth,
      config.maxBufferSize,
      config.canopyDepth
    );

    // Create the tree account
    const allocTreeIx = await createAllocTreeInstruction(
      this.connection,
      merkleTree.publicKey,
      payer.publicKey,
      { maxDepth: config.maxDepth, maxBufferSize: config.maxBufferSize },
      config.canopyDepth
    );

    // Initialize tree authority through your program
    const initTreeIx = await this.program.methods
      .initializeMerkleTree(config.maxDepth, config.maxBufferSize)
      .accounts({
        payer: payer.publicKey,
        treeAuthority,
        merkleTree: merkleTree.publicKey,
        noopProgram: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Combine instructions
    const transaction = new Transaction().add(allocTreeIx, initTreeIx);
    
    // Sign and send
    const signature = await this.connection.sendTransaction(
      transaction,
      [payer, merkleTree],
      { skipPreflight: false }
    );

    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log(`✅ Merkle tree created!`);
    console.log(`Tree Account: ${merkleTree.publicKey.toString()}`);
    console.log(`Tree Authority: ${treeAuthority.toString()}`);
    console.log(`Transaction: ${signature}`);

    return {
      merkleTree: merkleTree.publicKey,
      treeAuthority,
      signature
    };
  }

  /**
   * Create a compressed merchant
   */
  async createCompressedMerchant(
    merchantName: string,
    owner: Keypair,
    merkleTree: PublicKey,
    feeEligible: boolean = true,
    feePayer?: Keypair
  ): Promise<string> {
    // Find merchant PDA
    const [merchantPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('merchant'),
        Buffer.from(merchantName.trim()),
        owner.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    // Find tree authority
    const [treeAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('tree_authority')],
      this.program.programId
    );

    // Find compressed merchant state
    const [compressedMerchantState] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('compressed_merchant'),
        Buffer.from(merchantName.trim()),
        owner.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    // USDC mint (devnet)
    const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

    const signature = await this.program.methods
      .createMerchant(merchantName.trim(), true, feeEligible)
      .accounts({
        feePayer: feePayer?.publicKey || null,
        owner: owner.publicKey,
        merchant: merchantPda,
        usdcMint,
        merkleTree,
        treeAuthority,
        compressedMerchantState,
        noopProgram: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        // ... other required accounts
      })
      .signers(feePayer ? [owner, feePayer] : [owner])
      .rpc();

    console.log(`✅ Compressed merchant created: ${merchantName}`);
    console.log(`Merchant PDA: ${merchantPda.toString()}`);
    console.log(`Compressed State: ${compressedMerchantState.toString()}`);
    console.log(`Transaction: ${signature}`);

    return signature;
  }

  /**
   * Get compressed merchant state
   */
  async getCompressedMerchantState(
    merchantName: string,
    owner: PublicKey
  ): Promise<any> {
    const [compressedMerchantState] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('compressed_merchant'),
        Buffer.from(merchantName.trim()),
        owner.toBuffer(),
      ],
      this.program.programId
    );

    try {
      const state = await this.program.account.compressedMerchantState.fetch(compressedMerchantState);
      return state;
    } catch (error) {
      console.error('Error fetching compressed merchant state:', error);
      return null;
    }
  }

  /**
   * Recommended configurations for different use cases
   */
  static getRecommendedConfig(useCase: 'small' | 'medium' | 'large'): CompressionConfig {
    switch (useCase) {
      case 'small':
        return {
          maxDepth: 14,      // 2^14 = 16,384 merchants
          maxBufferSize: 64,
          canopyDepth: 10
        };
      case 'medium':
        return {
          maxDepth: 17,      // 2^17 = 131,072 merchants
          maxBufferSize: 256,
          canopyDepth: 12
        };
      case 'large':
        return {
          maxDepth: 20,      // 2^20 = 1,048,576 merchants
          maxBufferSize: 512,
          canopyDepth: 14
        };
      default:
        return {
          maxDepth: 14,
          maxBufferSize: 64,
          canopyDepth: 10
        };
    }
  }
}

// Example usage script
async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const payer = Keypair.generate(); // In production, load your keypair
  const wallet = new Wallet(payer);
  const programId = new PublicKey('RKAxBK5mBxYta3FUfMLHafMj8xakd8PLsH3PXFa773r');

  const compressionManager = new CompressionManager(connection, wallet, programId);

  // 1. Get recommended configuration
  const config = CompressionManager.getRecommendedConfig('medium');
  console.log('Using configuration:', config);

  // 2. Calculate costs
  const { size, costSOL } = compressionManager.calculateTreeCost(config);
  console.log(`Tree will require ${size} bytes and cost ~${costSOL} SOL`);

  // 3. Create Merkle tree
  const { merkleTree, treeAuthority } = await compressionManager.createMerkleTree(config, payer);

  // 4. Create compressed merchants
  const merchantOwner = Keypair.generate();
  await compressionManager.createCompressedMerchant(
    'My Store',
    merchantOwner,
    merkleTree,
    true // fee eligible
  );

  // 5. Check state
  const state = await compressionManager.getCompressedMerchantState('My Store', merchantOwner.publicKey);
  console.log('Compressed merchant state:', state);
}

// Uncomment to run
// main().catch(console.error);

export default CompressionManager; 