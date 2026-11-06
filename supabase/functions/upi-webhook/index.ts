// Future bank/payment-gateway webhook for UPI settlements. Not wired to any provider yet —
// this is the landing point for whichever one you add later. It verifies an HMAC-SHA256
// signature before trusting the body, then hands off to webhook_payment() (service-role only),
// which re-checks the order and amount server-side.
//
// Required secret: UPI_WEBHOOK_SECRET — a random string shared with the provider; they sign
// the raw request body with it and send the signature in the X-Signature header.
//
// Expected body: { "reference": "BB...", "utr": "...", "amount_paise": 4900 }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('UPI_WEBHOOK_SECRET');

async function verifySignature(rawBody: string, signatureHex: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expectedHex.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) diff |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'UPI_WEBHOOK_SECRET not configured' }), { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('X-Signature') ?? '';
  if (!signature || !(await verifySignature(rawBody, signature, WEBHOOK_SECRET))) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401 });
  }

  let body: { reference?: string; utr?: string; amount_paise?: number };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }
  if (!body.reference || !body.utr || typeof body.amount_paise !== 'number') {
    return new Response(JSON.stringify({ error: 'reference, utr and amount_paise are required' }), { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await adminClient.rpc('webhook_payment', {
    p_reference: body.reference,
    p_utr: body.utr,
    p_amount_paise: body.amount_paise,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
});
