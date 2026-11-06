# UPI payments — phone test guide

## Setup

1. Build and install the website APK (not the Play build — `VITE_PLAY_STORE` unset/false) on a phone that has GPay, PhonePe, and Paytm installed.
2. In the admin panel (`admin/`, `npm run dev`, or deployed), sign in as the owner (`help.mithaimatch@gmail.com` — set a password for that account first via Supabase Auth if it doesn't have one yet).
3. On **Payments**, confirm the UPI ID shows `2728412a@bandhan` / `AS Enterprice`, **Payments enabled: ON**, and **Activation: instant**.
4. On **Plans**, add a ₹1 test plan (e.g. code `test1`, 1 day, price ₹1) so you don't have to pay the full trial price repeatedly.

## Pay ₹1 with each app

For GPay, then PhonePe, then Paytm:

1. Open the app, go to **Plans**, tap **Buy ₹1** on the test plan.
2. The chosen UPI app opens with the amount, payee name, and a reference starting `BB` already filled in — confirm you never had to type an amount.
3. Complete the ₹1 payment, then back out to Mithai Match.
4. Confirm the correct result screen appears:
   - **Success** (most common with instant mode): plan name + valid-until date.
   - **Pending**: "We're verifying your payment…" plus a reference and UTR with copy buttons — this happens if the UPI app doesn't return a parseable response.
5. In the admin **Payments** table, confirm the order shows up with the right amount, reference, and status within a few seconds.

## Mark paid / Revoke

1. Find a `pending` order in the admin table (or create one — any order that didn't auto-activate).
2. Enter the UTR shown in your UPI app's transaction history, click **Mark paid**, confirm. The order should flip to `success` and the app's Plans screen should show the plan as active.
3. Click **Revoke** on that same order with a reason, confirm. Status flips to `revoked`, and the subscription ends immediately.
4. Try to mark another order paid with that same UTR — it should be rejected (blocked forever).

## Live price change

1. In the app, open **Plans** and leave it open.
2. In the admin panel, change the test plan's price (e.g. ₹1 → ₹2) and save.
3. Within a few seconds (no app restart), the price on the app's Plans screen should update — this is the Realtime subscription on `settings_version` doing its job.
4. Any **already-open order** from before the price change should still show the **old** amount if you complete it — open orders snapshot their price at creation time.

## What "done" looks like

- [ ] GPay, PhonePe, and Paytm all open with the right amount/payee/reference and return to the app cleanly
- [ ] Success, pending, and failed result screens all appear correctly at least once
- [ ] The admin sees every order within seconds, with correct amount/reference/status
- [ ] Mark paid activates the plan; Revoke ends it and blocks the UTR
- [ ] A changed price shows up in the app within seconds, without touching open orders
