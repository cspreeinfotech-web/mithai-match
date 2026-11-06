import { USE_MOCK_BILLING } from '../../config/app.config';
import { MockBillingProvider } from './mockBilling';
import { RealBillingProvider } from './realBilling';
import type { BillingProvider } from './types';

// MockBilling is picked only outside production mode. `npm run build` (used for any real/Play
// Store build, mode defaults to 'production') always gets RealBilling; only the sideload test
// APK — built by .github/workflows/android-debug.yml via `npm run build:mock` — gets MockBilling,
// since Google Play Billing only works for an app actually installed through Play.
export const billing: BillingProvider = USE_MOCK_BILLING ? new MockBillingProvider() : new RealBillingProvider();

export type { BillingProvider, PurchaseOutcome } from './types';
export { setMockOutcome, type MockOutcome } from './mockBilling';
