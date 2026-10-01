// Standard validation helpers for Admin forms

export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

export function isValidPakistaniPhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('03')) {
    return true;
  }
  if (digits.length === 12 && digits.startsWith('923')) {
    return true;
  }
  if (digits.length === 14 && digits.startsWith('00923')) {
    return true;
  }

  return false;
}
