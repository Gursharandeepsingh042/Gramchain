import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * PaymentService handles the integration with Fiat-to-Crypto on-ramps
 * specifically optimized for the Indian market (UPI, NEFT, IMPS).
 */

const ONMETA_API_KEY = process.env.EXPO_PUBLIC_ONMETA_API_KEY || 'demo-key';
const IS_SANDBOX = process.env.EXPO_PUBLIC_PAYMENT_ENV !== 'production';

export interface PaymentConfig {
  walletAddress: string;
  fiatAmount: number;
  fiatCurrency: 'INR';
  cryptoCurrency: 'USDC';
  chainId: number; // 137 for Polygon Mainnet, 80002 for Amoy
}

export const PaymentService = {
  /**
   * Generates a hosted widget URL for OnMeta.
   * OnMeta is the preferred partner for UPI/IMPS in India.
   */
  getOnMetaUrl: (config: PaymentConfig): string => {
    const baseUrl = IS_SANDBOX 
      ? 'https://stg.onmeta.in' 
      : 'https://onmeta.in';
      
    const params = new URLSearchParams({
      apiKey: ONMETA_API_KEY,
      walletAddress: config.walletAddress,
      fiatAmount: config.fiatAmount.toString(),
      fiatCurrency: config.fiatCurrency,
      cryptoCurrency: config.cryptoCurrency,
      chainId: config.chainId.toString(),
      isSandbox: IS_SANDBOX.toString(),
      metadata: JSON.stringify({ platform: 'GramChain-Mobile', role: 'LENDER' })
    });

    return `${baseUrl}/widget?${params.toString()}`;
  },

  /**
   * Transak is an alternative for global investors using Credit Cards/NEFT.
   */
  getTransakUrl: (config: PaymentConfig): string => {
    const baseUrl = IS_SANDBOX
      ? 'https://global-stg.transak.com'
      : 'https://global.transak.com';

    const params = new URLSearchParams({
      apiKey: process.env.EXPO_PUBLIC_TRANSAK_API_KEY || '',
      walletAddress: config.walletAddress,
      defaultCryptoCurrency: 'USDC',
      fiatCurrency: 'INR',
      fiatAmount: config.fiatAmount.toString(),
      network: 'polygon',
      paymentMethod: 'upi,neft_bank_transfer,imps_bank_transfer',
    });

    return `${baseUrl}?${params.toString()}`;
  },

  /**
   * Open the payment gateway using the system's secure browser.
   */
  launchGateway: async (url: string) => {
    console.log('🚀 Launching Payment Gateway:', url);
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#0f172a',
        controlsColor: '#3b82f6',
        showTitle: true,
      });
    } catch (error) {
      console.error('Failed to open payment gateway:', error);
    }
  }
};

