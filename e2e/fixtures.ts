import type { Page } from '@playwright/test';

// ─── Генераторы уникальных данных ─────────────────────────────────────────────

export function buildUserCredentials(prefix: string) {
  const ts = Date.now();
  return {
    name: `Test ${prefix} ${ts}`,
    email: `${prefix}-${ts}@test.local`,
    password: 'Password123!',
  };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signUp(page: Page, user: ReturnType<typeof buildUserCredentials>) {
  await page.goto('/register');
  await page.getByLabel(/имя/i).fill(user.name);
  await page.getByLabel(/email/i).fill(user.email);
  // Два поля пароля — берём первое
  const pwdFields = page.getByLabel(/пароль/i);
  await pwdFields.first().fill(user.password);
  await page.getByRole('button', { name: /зарегистрироваться|создать|войти/i }).click();
  // Ждём редиректа в лобби или на главную
  await page.waitForURL(/\/(lobby|$)/, { timeout: 10_000 });
}

export async function signIn(page: Page, user: ReturnType<typeof buildUserCredentials>) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/пароль/i).fill(user.password);
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL(/\/(lobby|$)/, { timeout: 10_000 });
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /выйти/i }).click();
  await page.waitForURL('/login', { timeout: 5_000 });
}
