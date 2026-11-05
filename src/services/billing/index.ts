import { USE_MOCK_BILLING } from '../../config/app.config';
import { MockBillingProvider } from './mockBilling';
import { RealBillingProvider } from './realBilling';
import type { BillingProvider } from './types';

// MockBilling is picked only outside production mode (debug APK) — android-release.yml
// always builds with --mode production, so a release build can never ship with MockBilling.
export const billing: BillingProvider = USE_MOCK_BILLING ? new MockBillingProvider() : new RealBillingProvider();

export type { BillingProvider, PurchaseOutcome } from './types';
export { setMockOutcome, type MockOutcome } from './mockBilling';
