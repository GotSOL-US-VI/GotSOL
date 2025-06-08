interface SOLPriceData {
  price: number;
  timestamp: number;
  expiresAt: number;
}

class SOLPriceService {
  private static instance: SOLPriceService;
  private priceCache: SOLPriceData | null = null;
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds
  private readonly PRICE_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';

  private constructor() {}

  static getInstance(): SOLPriceService {
    if (!SOLPriceService.instance) {
      SOLPriceService.instance = new SOLPriceService();
    }
    return SOLPriceService.instance;
  }

  /**
   * Get the current SOL price in USD with caching
   */
  async getSOLPrice(): Promise<number> {
    const now = Date.now();

    // Check if we have valid cached data
    if (this.priceCache && now < this.priceCache.expiresAt) {
      console.log('Using cached SOL price:', this.priceCache.price);
      return this.priceCache.price;
    }

    try {
      console.log('Fetching fresh SOL price from CoinGecko...');
      const response = await fetch(this.PRICE_API_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const price = data.solana?.usd;

      if (typeof price !== 'number' || price <= 0) {
        throw new Error('Invalid price data received');
      }

      // Cache the price
      this.priceCache = {
        price,
        timestamp: now,
        expiresAt: now + this.CACHE_DURATION
      };

      console.log('Fresh SOL price fetched and cached:', price);
      return price;

    } catch (error) {
      console.error('Error fetching SOL price:', error);
      
      // If we have expired cache data, use it as fallback
      if (this.priceCache) {
        console.warn('Using expired cache data as fallback');
        return this.priceCache.price;
      }

      // Ultimate fallback - use a reasonable default price
      const fallbackPrice = 100; // $100 SOL as fallback
      console.warn(`Using fallback SOL price: $${fallbackPrice}`);
      return fallbackPrice;
    }
  }

  /**
   * Convert USD amount to SOL amount
   */
  async convertUSDToSOL(usdAmount: number): Promise<{ solAmount: number; solPrice: number; expiresAt: number }> {
    const solPrice = await this.getSOLPrice();
    const solAmount = usdAmount / solPrice;
    
    return {
      solAmount,
      solPrice,
      expiresAt: this.priceCache?.expiresAt || Date.now() + this.CACHE_DURATION
    };
  }

  /**
   * Get cached price info for display purposes
   */
  getCachedPriceInfo(): { price: number; timestamp: number; expiresAt: number } | null {
    return this.priceCache;
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.priceCache = null;
  }
}

// Export singleton instance
export const solPriceService = SOLPriceService.getInstance();

// Export types for use elsewhere
export type { SOLPriceData }; 