import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendVerificationSms(to: string, message: string): Promise<void> {
  if (!client || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS send. Message:', message);
    return;
  }

  if (!to.startsWith('+971')) {
    throw new Error('Only UAE (+971) phone numbers are supported for SMS verification.');
  }

  await client.messages.create({
    to,
    from: fromNumber,
    body: message,
  });
}
