import crypto from 'crypto';

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const hashOtp = (iec: string, otp: string) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(`${iec}:${otp}`).digest('hex');

// TODO: plug in the SMS / email gateway here.
export async function sendOtp(_mobile: string, _email: string, otp: string) {
  if (process.env.NODE_ENV !== 'production') console.log(`[DEV] OTP: ${otp}`);
}

export const mask = {
  mobile: (m: string) => m.replace(/.(?=.{4})/g, '*'),
  email: (e: string) => e.replace(/^(.)[^@]*/, '$1****'),
};
