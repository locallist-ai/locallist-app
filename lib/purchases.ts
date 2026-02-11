import { Platform } from 'react-native';

// RevenueCat integration placeholder
// Full implementation requires react-native-purchases which needs native module linking
// For now, we provide the types and a mock for development

interface PurchasesConfig {
  apiKey: string;
}

interface CustomerInfo {
  entitlements: {
    active: Record<string, { identifier: string; isActive: boolean }>;
  };
}

let isConfigured = false;

export async function configurePurchases(): Promise<void> {
  const apiKey = process.env.EXPO_PUBLIC_RC_API_KEY;
  if (!apiKey) {
    console.warn('RevenueCat API key not set — purchases disabled');
    return;
  }

  // TODO: Initialize RevenueCat SDK when react-native-purchases is added
  // import Purchases from 'react-native-purchases';
  // Purchases.configure({ apiKey });
  isConfigured = true;
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!isConfigured) return false;

  // TODO: Check actual entitlement
  // const customerInfo = await Purchases.getCustomerInfo();
  // return !!customerInfo.entitlements.active['pro'];
  return false;
}

export async function presentPaywall(): Promise<boolean> {
  if (!isConfigured) {
    console.warn('Purchases not configured');
    return false;
  }

  // TODO: Present RevenueCat paywall
  // const { customerInfo } = await Purchases.presentPaywall();
  // return !!customerInfo?.entitlements.active['pro'];
  return false;
}

export async function identifyUser(userId: string): Promise<void> {
  if (!isConfigured) return;
  // TODO: Purchases.logIn(userId);
}
