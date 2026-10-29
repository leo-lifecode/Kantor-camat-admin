# Expo Push Notifications - Antrian Talawi

## Implemented

- After login, the warga app requests notification permission, retrieves an Expo Push Token and upserts it into `public.device_tokens`.
- The deployed Supabase Edge Function `send-queue-push` sends push notifications for `QUEUE_CALLED` rows and cleans up tokens Expo reports as `DeviceNotRegistered`.

## Activate the database-to-push connection

The Edge Function is deployed to project `ncjuntgddvxhrfzxvsbc`. The database webhook still needs to be configured.

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/ncjuntgddvxhrfzxvsbc/database/hooks
2. Create a Database Webhook named `queue-called-push`.
3. Select schema `public`, table `notifications`, event `INSERT`.
4. Select Edge Function `send-queue-push` as the target.
5. Add the project's **secret API key** as the `apikey` header. Do not use the publishable/anon key. The function validates this header against the server-side `SUPABASE_SECRET_KEYS` environment value.
6. Save the webhook.

The secret key belongs only in Supabase server configuration. Never commit it or put it in the APK.

## Android and EAS checks

1. Confirm `mobile-warga/google-services.json` belongs to the Firebase project associated with the Android FCM V1 service-account credential configured in EAS.
2. Build and install a new APK after any native Firebase or notification configuration changes.
3. Sign in from the APK and grant notification permission. Verify a row for the account appears in `public.device_tokens`.
4. Call that warga's queue from the admin dashboard while the APK is backgrounded, then verify the push arrives.
5. Check Edge Function logs and Supabase Database Webhook delivery logs if it does not.

## Current limitations

- Expo Push Service tickets show that Expo accepted a message, not necessarily that the device displayed it. Production-grade reliability should add push-receipt polling and retry handling.
- Local notification/speech logic remains in the app for foreground status changes.
