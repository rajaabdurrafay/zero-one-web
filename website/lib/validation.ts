// Standard validation helpers for Website forms

export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  // Standard RFC 5322 compatible email pattern
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates Pakistani phone numbers:
 * - Local standard: 03001234567 (11 digits, starts with 03)
 * - International standard: +923001234567 (or 923001234567, 00923001234567)
 * - Allows spaces and hyphens e.g. 0300 1234567 or 0300-1234567
 */
export function isValidPakistaniPhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');

  // Format 1: 03XXXXXXXXX (11 digits starting with 03)
  if (digits.length === 11 && digits.startsWith('03')) {
    return true;
  }

  // Format 2: 923XXXXXXXXX (12 digits starting with 923)
  if (digits.length === 12 && digits.startsWith('923')) {
    return true;
  }

  // Format 3: 00923XXXXXXXXX (14 digits starting with 00923)
  if (digits.length === 14 && digits.startsWith('00923')) {
    return true;
  }

  return false;
}

/**
 * Validates phone or email (for login field):
 */
export function isValidPhoneOrEmail(identifier: string): boolean {
  if (!identifier || !identifier.trim()) return false;
  const clean = identifier.trim();
  if (clean.includes('@')) {
    return isValidEmail(clean);
  }
  return isValidPakistaniPhone(clean);
}
