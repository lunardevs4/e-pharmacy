# Remaining integration plan for Rwanda E-Pharmacy

This document explains what is still left to complete and how the remaining services should be integrated into the backend in a realistic production setup.

## 1) What is still remaining

The project is functionally close, but the remaining work is mostly operational and integration-level rather than a full rebuild.

### Remaining backend work

- Final production environment validation for all providers
- Real SMS gateway integration for medication reminders
- Real voice/IVR integration for missed-dose and follow-up reminders
- Real TTS integration for Kinyarwanda reminder messages
- Real email provider integration for notification delivery
- Redis or queueing layer optional but recommended for high-volume reminders
- Real storage for prescription and pharmacy document uploads
- Monitoring and alerting for reminder delivery failures
- Retention and privacy policy for uploaded patient data and reminder logs
- Final security review before production deployment

### Remaining product/QA work

- Confirm reminder flow with actual patient and pharmacy data
- Validate missed-dose detection and adherence calculation in production-like data
- Test SMS/voice/TTS fallback behavior when provider is down
- Confirm encryption and masking of sensitive values in logs and audit trail
- Validate provider retry behavior and escalation rules

---

## 2) Where these services are integrated in the app

The service layer already has a structured integration point for communication and reminders.

### SMS, voice, and TTS entry points

These are currently handled through the communication service layer:

- src/common/communication/communication.service.ts
- src/reminders/reminder-scheduler.service.ts
- src/reminders/reminders.service.ts

The integration pattern is:

1. Reminder scheduler decides a dose is due
2. It builds the message content
3. It calls the communication service
4. Communication service selects provider mode and invokes the relevant provider
5. Provider returns status, message ID, and retry metadata
6. Scheduler writes the log and updates reminder status

This is the correct place to plug in Twilio, Africa’s Talking, Azure Speech, or another provider.

---

## 3) How to integrate each service

## 3.1 SMS integration

### Recommended providers for Rwanda

- Africa’s Talking
- Twilio
- Local telecom SMS provider with API access

### Integration approach

- Keep the current abstraction in CommunicationService
- Add a provider adapter for the chosen SMS gateway
- Map the provider response into the existing CommunicationResult format
- Use provider mode switching:
  - mock for development
  - live for production

### Example flow

1. Configure env variables in .env
2. Set SMS_PROVIDER_MODE=live
3. Add the API key and secret
4. Use the provider SDK or HTTP API to send SMS
5. Return status: SENT, DELIVERED, FAILED
6. Save status to reminder log in the scheduler

### Required env values

- SMS_PROVIDER_MODE
- SMS_API_KEY
- SMS_API_SECRET
- SMS_FROM_NUMBER
- SMS_MAX_RETRIES

### Recommended handling

- Retry on transient errors
- Keep SMS IDs for delivery tracking
- Log provider reference and failure reason
- Do not expose secrets in application logs

---

## 3.2 Voice reminder integration

### Recommended providers

- Twilio Voice
- Telnyx
- Local telecom IVR service

### Integration approach

- Reuse the same communication abstraction
- Add a voice provider client that initiates a call or adds to the call queue
- If the provider supports text-to-speech, pass the generated Kinyarwanda text
- If the provider does not support Kinyarwanda directly, use prerecorded prompts or a multilingual workflow

### What the app should do

- When a reminder is missed or due and patient cannot confirm via app, trigger voice call
- Keep call status in reminder logs
- Accept answered / no answer / busy / failed states

### Required env values

- VOICE_PROVIDER_MODE
- VOICE_API_KEY
- VOICE_API_SECRET
- VOICE_MAX_RETRIES

---

## 3.3 Kinyarwanda TTS integration

### Recommended providers

- Azure Speech Services with a compatible Kinyarwanda voice where supported
- Google Cloud Text-to-Speech if a Rwanda-compatible voice is available
- Telecom provider with pre-recorded Kinyarwanda scripts

### Integration approach

- Add a real TTS client behind the communication abstraction
- Generate a natural-language reminder message in Kinyarwanda
- Example message:
  - “Ushobora gufata ibiyobyabwenge byawe, mu gihe cy’isaha 20:00.”
- Use provider-specific voice selection from env

### Required env values

- TTS_PROVIDER_MODE
- TTS_API_KEY
- TTS_API_SECRET
- TTS_LANGUAGE=rw
- TTS_VOICE

### Recommended production decision

If direct Kinyarwanda voice support is unavailable, use a hybrid model:

- provider sends a call to patient
- a Kinyarwanda script is read by a human-voice prompt library or telecom IVR prompt set
- fallback to SMS if voice is unavailable

---

## 3.4 Email integration

### Recommended providers

- SendGrid
- Resend
- Mailgun
- Amazon SES
- Corporate SMTP relay

### Integration approach

- Use the existing EmailService abstraction
- Replace any mock SMTP behavior with a real transactional provider
- Track email status and failures as part of reminder notification flow

### Required env values

- GMAIL_USER
- GMAIL_APP_PASSWORD

For production, Gmail is acceptable only for development or a temporary internal deployment. Use a dedicated sending service in production.

---

## 3.5 Monitoring and alerting integration

### Recommended stack

- Sentry for API errors and release monitoring
- Datadog / Azure Monitor / Logtail for metrics and logs
- uptime service for health checks

### Integration approach

- Capture application exceptions and delivery failures
- Add alerts for SMS/voice failures, reminder backlog, or missed-dose spikes
- Log provider error rates per provider and per patient group

### Examples of needed alerts

- SMS provider failure rate > 10% in 15 minutes
- voice reminder queue backlog
- reminder scheduler not running
- multiple missed-dose anomalies for one schedule

### Required env values

- MONITORING_PROVIDER
- MONITORING_API_KEY

---

## 3.6 Storage and upload integration

### Recommended providers

- AWS S3
- Azure Blob Storage
- Cloudinary
- MinIO for internal/self-hosted environments

### Integration approach

- Replace local upload handling with cloud object storage
- Store uploaded prescriptions and pharmacy license files with expiry or retention rules
- Keep only a safe URL or object key in the database
- Add secure access rules to protect patient data

### Why this matters

The app currently writes locally to uploads. That is acceptable for dev/testing, but production needs immutable, secure, and monitored storage.

---

## 4) Integration sequence recommended

Follow this order:

1. Configure PostgreSQL and app secrets
2. Configure production base environment variables
3. Activate SMS provider in live mode
4. Validate reminder dispatch logs end-to-end
5. Activate voice provider for missed-dose follow-up
6. Activate TTS provider for Kinyarwanda reminders
7. Configure email provider and test notifications
8. Connect monitoring / alerting
9. Configure uploaded-file storage
10. Run full QA with real patient flows

---

## 5) Practical production recommendation for Rwanda

The most realistic setup is:

- PostgreSQL managed database
- SMS via Africa’s Talking or a Rwandan telecom gateway
- Voice via Twilio Voice or telecom IVR provider
- TTS via Azure Speech or Google TTS with Kinyarwanda support
- Email via SendGrid or a transactional SMTP provider
- Object storage via AWS S3 or Azure Blob Storage
- Sentry plus uptime monitoring
- Central secret manager for API keys and tokens

This fits the app’s architecture and keeps the integration points clean without rewriting the backend.

---

## 6) Recommended production rule

For production, the backend should only be considered ready when each service is validated in live mode and every provider failure path has a clear fallback.

The current app already supports mock mode for testing. That should stay for local and QA environments, but not for launch.

---

## 7) Final remaining checklist

- [ ] Real database configured and tested
- [ ] Real SMS provider configured and tested
- [ ] Real voice provider configured and tested
- [ ] Real Kinyarwanda TTS configured and tested
- [ ] Email provider configured and tested
- [ ] Monitoring configured and alert rules set
- [ ] Upload storage configured and secured
- [ ] Retention policy implemented
- [ ] Reminder QA completed on live-like data
- [ ] Security/privacy review completed

This is the remaining roadmap for production integration.
