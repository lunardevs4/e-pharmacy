# Rwanda E-Pharmacy Production Configuration Checklist

This checklist captures the services, credentials, and operational settings the backend expects before it can run in a realistic production environment.

## 1. Core application services

### PostgreSQL database

Required for Prisma and the app's relational data model.

- Provider: PostgreSQL 14+ (local, Neon, Supabase, Azure Database for PostgreSQL, Render Postgres, Railway, or managed RDS)
- Required variable:
  - `DATABASE_URL`
- Example:
  - `postgresql://user:password@host:5432/epharmacy_prod?schema=public`
- Recommended:
  - dedicated database for production
  - daily backups
  - connection pooling enabled

### JWT and auth secrets

Required for account authentication and refresh-token flow.

- Required variables:
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `REFRESH_TOKEN_EXPIRES_IN`
- Rules:
  - `JWT_SECRET` must be at least 32 characters
  - use a strong random secret in production, never commit it to source control

### HTTP configuration

Required for API access and browser security.

- Required variables:
  - `PORT`
  - `FRONTEND_URL`
  - `CORS_ORIGINS`
  - `COOKIE_SAME_SITE`
- Typical values:
  - `FRONTEND_URL=https://app.example.com`
  - `CORS_ORIGINS=https://app.example.com,https://admin.example.com`

---

## 2. Communication / reminder services

### SMS provider

This is required for reminders and patient notifications.

Realistic production options:

- Twilio
- Africa’s Talking
- MessageBird
- Local telecom gateway provider for Rwanda

Required variables:

- `SMS_PROVIDER_MODE=live`
- `SMS_API_KEY`
- `SMS_API_SECRET`
- `SMS_FROM_NUMBER`
- `SMS_MAX_RETRIES`

Recommended behavior:

- keep `SMS_PROVIDER_MODE=mock` in local development
- switch to `live` only when a real account and sender number are configured

### Voice reminder provider

Required for IVR / voice medication reminders.

Realistic options:

- Twilio Voice
- Telnyx
- local telecom voice gateway

Required variables:

- `VOICE_PROVIDER_MODE=live`
- `VOICE_API_KEY`
- `VOICE_API_SECRET`
- `VOICE_MAX_RETRIES`

### Kinyarwanda-capable TTS provider

Required for automated spoken reminder messages in Kinyarwanda.

Recommended realistic choices:

1. Azure Speech Services with a Kinyarwanda-capable voice if supported in your region
2. Google Cloud Text-to-Speech with a voice model that supports Kinyarwanda when available
3. Twilio/telephony provider with pre-recorded Kinyarwanda prompts if the service does not expose a direct Kinyarwanda voice model

Required variables:

- `TTS_PROVIDER_MODE=live`
- `TTS_API_KEY`
- `TTS_API_SECRET`
- `TTS_LANGUAGE=rw`
- `TTS_VOICE`

Recommended default:

- `TTS_LANGUAGE=rw`
- `TTS_VOICE` = provider-specific voice name for a Kinyarwanda voice

---

## 3. Email service

The backend supports email notifications for pharmacy and reminder communication.

Typical provider:

- Gmail SMTP app password for development/testing
- SendGrid, Resend, Mailgun, SES, or a corporate SMTP relay for production

Required variables:

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

Production recommendation:

- use a dedicated transactional email provider instead of personal Gmail
- rate-limit and track deliverability

---

## 4. Monitoring and observability

Required to monitor application health and reminder delivery quality.

Recommended services:

- Sentry for errors and release tracking
- Logtail / Datadog / New Relic / Azure Monitor for logs and metrics
- uptime monitoring (Pingdom, Better Stack, Uptime.com)

Required variables:

- `MONITORING_PROVIDER`
- `MONITORING_API_KEY`

Suggested values:

- `MONITORING_PROVIDER=sentry`
- `MONITORING_PROVIDER=mock` for local development

---

## 5. File storage / document uploads

The app accepts uploaded documents for prescriptions and pharmacy licenses.

Recommended storage options:

- AWS S3
- Azure Blob Storage
- Cloudinary
- MinIO for self-hosting

Current app behavior expects local upload directories by default, but for production a cloud storage bucket is strongly recommended.

Required operational setup:

- secure bucket / container permissions
- lifecycle rules for uploaded files
- antivirus / malware scanning for uploaded documents
- retention policy for uploaded prescription files

---

## 6. Network, security, and infra dependencies

### Reverse proxy / TLS

Required for production HTTPS.

Recommended:

- Nginx / Caddy / Cloudflare Tunnel / Azure App Service / Render / Railway ingress

### Secrets management

Recommended:

- Doppler
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- GitHub Actions / environment secrets for CI/CD

### Domain and DNS

You will need:

- API hostname
- frontend hostname
- optional admin hostname
- DNS records and TLS certificate

---

## 7. Environment variable map from the app

The app currently expects these values in `.env`:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET=your-strong-secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
COOKIE_SAME_SITE=lax
PORT=3000

THROTTLE_GLOBAL_LIMIT=100
THROTTLE_GLOBAL_TTL_MS=60000
THROTTLE_LOGIN_LIMIT=5
THROTTLE_LOGIN_TTL_MS=60000
THROTTLE_REGISTRATION_LIMIT=3
THROTTLE_REGISTRATION_TTL_MS=60000
THROTTLE_PASSWORD_LIMIT=3
THROTTLE_PASSWORD_TTL_MS=900000
THROTTLE_MEDICINE_SEARCH_LIMIT=60
THROTTLE_MEDICINE_SEARCH_TTL_MS=60000
THROTTLE_USER_SENSITIVE_LIMIT=10
THROTTLE_USER_SENSITIVE_TTL_MS=60000

SMS_PROVIDER_MODE=live
SMS_API_KEY=
SMS_API_SECRET=
SMS_FROM_NUMBER=
SMS_MAX_RETRIES=3

VOICE_PROVIDER_MODE=live
VOICE_API_KEY=
VOICE_API_SECRET=
VOICE_MAX_RETRIES=2

TTS_PROVIDER_MODE=live
TTS_API_KEY=
TTS_API_SECRET=
TTS_LANGUAGE=rw
TTS_VOICE=

MONITORING_PROVIDER=sentry
MONITORING_API_KEY=

GMAIL_USER=
GMAIL_APP_PASSWORD=
```

---

## 8. Production recommendation for Rwanda

For Rwanda deployment, the most realistic production stack is:

- PostgreSQL managed database
- SMS gateway: local telecom provider or Twilio/Africa’s Talking
- Voice reminders: Twilio Voice or local telecom IVR provider
- TTS: Azure Speech or Google Cloud TTS with Kinyarwanda voice support, or prerecorded Kinyarwanda voice prompts via telecom provider
- SMTP: SendGrid or dedicated transactional email provider
- Monitoring: Sentry + uptime monitoring
- Storage: S3/Blob storage for uploaded documents
- Secrets: centralized secret store

---

## 9. Minimum launch checklist before production

- [ ] PostgreSQL database created and reachable
- [ ] `.env` populated with real secrets
- [ ] JWT secret generated and stored securely
- [ ] CORS origins configured for the frontend/admin domains
- [ ] SMS provider credentials tested
- [ ] Voice provider credentials tested
- [ ] Kinyarwanda TTS provider validated
- [ ] email provider validated
- [ ] file storage bucket configured
- [ ] monitoring provider enabled
- [ ] backup/retention policy set
- [ ] TLS certificates and DNS configured
- [ ] health check endpoint tested

---

## 10. Practical note

The backend already supports a `mock` mode for local development. That is useful for testing and QA, but production should use real providers for SMS, voice, TTS, email, monitoring, and storage.
