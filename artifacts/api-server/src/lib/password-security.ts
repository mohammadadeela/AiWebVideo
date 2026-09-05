import bcrypt from 'bcryptjs';

/** Compare against every retained bcrypt hash without short-circuiting. */
export async function passwordMatchesAny(password: string, hashes: string[]): Promise<boolean> {
  let matched = false;
  for (const hash of hashes) {
    if (await bcrypt.compare(password, hash)) matched = true;
  }
  return matched;
}
