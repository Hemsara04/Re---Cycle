/** Same rule as the profiles.phone check constraint in the database. */
const SL_MOBILE = /^(\+94|94|0)7[0-9]{8}$/;

export function normalizePhone(input: string) {
  return input.replace(/[\s-]/g, "");
}

export function isValidPhone(input: string) {
  return SL_MOBILE.test(normalizePhone(input));
}
