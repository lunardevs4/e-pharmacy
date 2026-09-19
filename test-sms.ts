import { config } from 'dotenv';
config();

import { ConfigService } from '@nestjs/config';
import { smsProviderFactory } from './src/common/communication/sms/sms-provider.factory';
import { CommunicationService } from './src/common/communication/communication.service';
import { formatRwandaPhoneNumber, maskPhoneNumber } from './src/common/communication/sms/esms-africa-sms.provider';

async function runTest() {
  const args = process.argv.slice(2);
  const isLiveMode = args.includes('--live') || process.env.LIVE_SMS === 'true';
  const statusFlagIndex = args.indexOf('--status');

  console.log('====================================================');
  console.log('📱 Rwanda E-Pharmacy SMS Delivery & Verification CLI');
  console.log('====================================================');

  const apiKeyPresent = Boolean(process.env.ESMS_API_KEY && process.env.ESMS_API_KEY.trim().length > 0);
  console.log('ESMS_API_KEY Configured:', apiKeyPresent ? 'YES (Key Present)' : 'NO (Missing)');
  console.log('ESMS_BASE_URL:', process.env.ESMS_BASE_URL || 'Default (https://sms.esmsafrica.io/api)');
  console.log('ESMS_SENDER_ID:', process.env.ESMS_SENDER_ID || 'eSMSAfrica');
  console.log('MODE:', isLiveMode ? 'LIVE (Real SMS Dispatch)' : 'DRY-RUN / VERIFICATION (Pass --live to send real SMS)');

  const configService = new ConfigService(process.env);
  const provider = smsProviderFactory(configService);
  const commsService = new CommunicationService(provider);

  console.log(`Active Provider Adapter: [${provider.name}]`);

  // Handle checking delivery status of a previously sent message ID
  if (statusFlagIndex !== -1 && args[statusFlagIndex + 1]) {
    const messageId = args[statusFlagIndex + 1];
    console.log(`\n🔍 Fetching status for Provider Message ID: ${messageId}...`);
    const statusResult = await commsService.checkSmsStatus(messageId);
    
    console.log('\n----------------------------------------------------');
    console.log('INTERNAL MESSAGE ID:', statusResult.messageId);
    console.log('PROVIDER MESSAGE ID:', statusResult.providerReference);
    console.log('MAPPED STATUS      :', statusResult.status);
    console.log('PROVIDER           :', statusResult.provider);
    if (statusResult.error) {
      console.log('ERROR DETAIL       :', statusResult.error);
    }
    console.log('----------------------------------------------------');
    process.exit(statusResult.status === 'FAILED' ? 1 : 0);
  }

  // Parse positional arguments cleanly (ignoring --flags)
  const positionalArgs = args.filter((a) => !a.startsWith('--'));
  const targetPhoneArg = positionalArgs[0] || '+250780000000';
  const customMessage = positionalArgs[1] || 'Rwanda E-Pharmacy SMS Audit Test: Confirmation of provider delivery workflow.';

  const { formatted, isValid } = formatRwandaPhoneNumber(targetPhoneArg);
  console.log(`Target Phone (Input): ${targetPhoneArg} -> Formatted: ${formatted} (Valid: ${isValid})`);

  if (!isValid) {
    console.error(`❌ Invalid Rwanda/E.164 phone number: ${targetPhoneArg}`);
    process.exit(1);
  }

  if (!isLiveMode) {
    console.log('\n⚠️  DRY-RUN MODE ACTIVE: Verification check passed. To send an actual carrier SMS, append --live:');
    console.log(`   npx ts-node test-sms.ts --live ${targetPhoneArg} "${customMessage}"`);
    console.log('----------------------------------------------------');
    process.exit(0);
  }

  console.log(`\nDispatching real SMS to ${maskPhoneNumber(formatted)}...`);
  const result = await commsService.sendSms(formatted, customMessage);

  console.log('\n----------------------------------------------------');
  console.log('INTERNAL TRACKING ID:', result.messageId);
  console.log('PROVIDER MESSAGE ID :', result.providerReference || '(None returned)');
  console.log('SUBMISSION STATUS   :', result.status);
  console.log('PROVIDER NAME       :', result.provider);

  if (result.status === 'QUEUED' || result.status === 'SUBMITTED') {
    console.log('ℹ️  Note: Message status is QUEUED/SUBMITTED by provider (Accepted for delivery).');
    console.log(`    Use --status ${result.providerReference} to poll for final DELIVERED state.`);
  }

  if (result.error) {
    console.log('ERROR DETAIL        :', result.error);
    console.log('❌ SMS Dispatch failed.');
    process.exit(1);
  } else {
    console.log('✅ SMS Request Accepted Successfully!');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Fatal Execution Error:', err);
  process.exit(1);
});
