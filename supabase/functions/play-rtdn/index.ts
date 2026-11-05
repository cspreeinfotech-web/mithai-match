// STUB — Google Play Real-time Developer Notifications (refunds/voids/renewals).
// The schema is ready (purchases.status already has a 'voided' state); the actual handling
// is a TODO, documented in MANUAL_STEPS.md for when you're ready to wire it up. Setting this
// up requires: a Pub/Sub topic in Google Cloud, Play Console pointed at it, and this function
// subscribed as a push endpoint. Until then, refunds simply aren't reflected automatically —
// revoking access for a refunded purchase would need to be done manually via the dashboard.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RtdnMessage {
  message: { data: string }; // base64-encoded JSON: { packageName, subscriptionNotification? | oneTimeProductNotification?, ... }
}

Deno.serve(async (req) => {
  // TODO: verify the Pub/Sub push request's authenticity (OIDC token in the Authorization
  // header, checked against the service account you configure in Cloud Pub/Sub) before
  // trusting anything in the body — this stub does NOT do that yet.
  try {
    const body = (await req.json()) as RtdnMessage;
    const decoded = JSON.parse(atob(body.message.data)) as Record<string, unknown>;

    // TODO: when a oneTimeProductNotification with notificationType === VOIDED arrives,
    // look up the purchase by its token and flip purchases.status to 'voided', then decide
    // whether/how to revoke the coins/lives it granted.
    console.log('play-rtdn received (not yet processed):', decoded);

    const _adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY); // kept for the TODO above
    void _adminClient;

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('play-rtdn parse error', err);
    return new Response('ok', { status: 200 }); // ack anyway so Pub/Sub doesn't redeliver forever
  }
});
