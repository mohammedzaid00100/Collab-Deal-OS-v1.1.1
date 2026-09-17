export const MINIMUM_ACCOUNT_AGE = 13;

export type AgeCheckResult = {
  valid: boolean;
  age: number | null;
  isMinor: boolean;
  message?: string;
};

export function calculateAge(dateOfBirth: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (
    dob.getUTCFullYear() !== year
    || dob.getUTCMonth() !== month - 1
    || dob.getUTCDate() !== day
  ) return null;

  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) age -= 1;
  return age;
}

export function checkDateOfBirth(dateOfBirth: string): AgeCheckResult {
  const age = calculateAge(dateOfBirth);
  if (age === null) return { valid: false, age: null, isMinor: false, message: 'Enter a valid date of birth.' };
  if (age < 0) return { valid: false, age, isMinor: true, message: 'Date of birth cannot be in the future.' };
  if (age > 120) return { valid: false, age, isMinor: false, message: 'Enter a realistic date of birth.' };
  if (age < MINIMUM_ACCOUNT_AGE) {
    return { valid: false, age, isMinor: true, message: `Collab Deal OS accounts require users to be at least ${MINIMUM_ACCOUNT_AGE}.` };
  }
  return { valid: true, age, isMinor: age < 18 };
}

export function hasRecordedDateOfBirth(value: unknown) {
  return typeof value === 'string' && checkDateOfBirth(value).valid;
}
