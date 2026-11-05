// Verifies an Android in-app purchase server-side (NEVER trust the client) with the Google
// Play Developer API, then credits the player atomically and idempotently via the
// apply_purchase() Postgres function. Required secrets (see supabase/README.md):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — the whole service-account JSON key, as one string
//   ANDROID_PACKAGE_NAME         — e.g. com.example.mithaimatch
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PACKAGE_NAME = Deno.env.get('ANDROID_PACKAGE_NAME') ?? '';

// Must match src/config/products.config.ts — Edge Functions run in a separate Deno runtime
// and can't import that file directly, so this mapping is duplicated. Keep both in sync.
const PRODUCT_CATALOG: Record<string, { coins: number; lives: number }> = {
  coins_300: { coins: 300, lives: 0 },
  coins_900: { coins: 900, lives: 0 },
  coins_2200: { coins: 2200, lives: 0 },
  coins_5500: { coins: 5500, lives: 0 },
  lives_refill_5: { coins: 0, lives: 5 },
  continue_moves_5: { coins: 0, lives: 0 }, // grants a per-attempt move bonus, applied client-side
};

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON secret is not set');
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(claims)))}`;

  const pemBody = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsigned));
  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google OAuth token request failed: ${await tokenRes.text()}`);
  const tokenJson = (await tokenRes.json()) as { access_token: string };
  return tokenJson.access_token;
}

interface VerifyPurchaseBody {
  productId: string;
  purchaseToken: string;
  packageName?: string;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'missing Authorization header' }, 401);

    const body = (await req.json()) as VerifyPurchaseBody;
    const product = PRODUCT_CATALOG[body.productId];
    if (!product) return json({ error: 'unknown productId' }, 400);
    if (!body.purchaseToken) return json({ error: 'missing purchaseToken' }, 400);

    const packageName = body.packageName || PACKAGE_NAME;
    if (!packageName) return json({ error: 'missing packageName' }, 400);

    // Identify the caller from their own session JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'invalid session' }, 401);

    // Verify with Google — this is the step that makes this trustworthy; the client's own
    // claim about the purchase is never taken at face value.
    const accessToken = await getGoogleAccessToken();
    const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${body.productId}/tokens/${body.purchaseToken}`;
    const verifyRes = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!verifyRes.ok) {
      return json({ error: 'developer_error', detail: await verifyRes.text() }, 502);
    }
    const purchase = (await verifyRes.json()) as { purchaseState?: number; orderId?: string; purchaseTimeMillis?: string };

    // purchaseState: 0 = purchased, 1 = canceled, 2 = pending. Only 0 is grantable.
    if (purchase.purchaseState === 2) return json({ status: 'pending', granted: false });
    if (purchase.purchaseState !== 0) return json({ status: 'canceled', granted: false });

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: applied, error: applyError } = await adminClient.rpc('apply_purchase', {
      p_user_id: userData.user.id,
      p_product_id: body.productId,
      p_purchase_token: body.purchaseToken,
      p_order_id: purchase.orderId ?? null,
      p_price_micros: null,
      p_currency: null,
      p_coins: product.coins,
      p_lives: product.lives,
    });
    if (applyError) return json({ error: applyError.message }, 500);

    return json({
      status: 'purchased',
      granted: true,
      productId: body.productId,
      // For continue_moves_5 the client applies +5 moves locally to the frozen attempt once
      // it sees granted: true — there's no separate signed token in this implementation
      // (see ASSUMPTIONS.md for the simplification).
      purchase: applied,
    });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
