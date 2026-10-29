# Expo Push Notifications - Antrian Talawi

## What's implemented

- The warga app requests notification permission after login, obtains an Expo Push Token, and upserts it into `public.device_tokens`.
- `supabase/functions/send-queue-push/index.ts` sends a push notification for a `QUEUE_CALLED` row and removes tokens rejected by Expo as `DeviceNotRegistered`.

## Required server configuration

Set these secrets for the Supabase Edge Function (never put the service-role key in the mobile app):

- `SUPABASE_URL`: project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: project service-role key.
- `QUEUE_PUSH_WEBHOOK_SECRET`: a long random secret used to authenticate the database webhook.

Deploy function `send-queue-push` with JWT verification disabled only because the database webhook authenticates using `x-webhook-secret`. Do not expose that secret in the app or repository.

## Connect database events

Create a Supabase Database Webhook on `public.notifications`, event `INSERT`, pointing to:

`https://ncjuntgddvxhrfzxvsbc.supabase.co/functions/v1/send-queue-push`

Add header `x-webhook-secret: <same QUEUE_PUSH_WEBHOOK_SECRET>` and `Content-Type: application/json`. The function ignores rows except `type = QUEUE_CALLED` and reads the target user's tokens from `device_tokens`.

## Android requirements

1. Confirm `mobile-warga/google-services.json` belongs to the same Firebase project as the FCM V1 service-account credential configured for the EAS project.
2. Build and install a new native APK with EAS after configuring credentials. Expo Go is not a valid remote-push test target for this Android setup.
3. Sign in on the APK and accept notification permission. Confirm a row appears in `public.device_tokens`.
4. Test by calling a queue from the admin dashboard while the warga app is backgrounded.

## Notes

- The app still uses local notification and speech when it is actively observing a queue status change. Push delivery is separate and can reach the device while the app is backgrounded or terminated.
- Expo tickets only confirm Expo accepted the message. For production reliability, add scheduled push-receipt checks and retry handling.
