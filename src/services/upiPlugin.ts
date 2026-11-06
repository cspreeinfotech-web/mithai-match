import { registerPlugin } from '@capacitor/core';

export interface UpiPlugin {
  // Resolves with whatever string the UPI app returned (parsed server-side), or rejects
  // with 'NO_UPI_APP' | 'BUSY' | 'MISSING_URI'.
  startUpi(options: { uri: string }): Promise<{ response: string }>;
}

export const Upi = registerPlugin<UpiPlugin>('Upi');
