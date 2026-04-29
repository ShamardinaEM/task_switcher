import { expect, test } from '@playwright/test';
import { buildUserCredentials, signIn, signOut, signUp } from './fixtures';

test('auth: регистрация, вход и выход', async ({ page }) => {
  const user = buildUserCredentials('auth-flow');

  // Регистрация
  await signUp(page, user);
  await expect(page).toHaveURL(/\/(lobby)?$/);

  // Имя пользователя отображается в навбаре
  await expect(page.getByRole('navigation').getByText(user.name, { exact: true })).toBeVisible();

  // Выход
  await signOut(page);
  await expect(page).toHaveURL('/login');

  // Повторный вход
  await signIn(page, user);
  await expect(page.getByRole('navigation').getByText(user.name, { exact: true })).toBeVisible();
});

test('auth: защищённые страницы редиректят на /login без сессии', async ({ page }) => {
  await page.goto('/stats');
  await expect(page).toHaveURL('/login');
});

test('auth: нельзя войти с неверным паролем', async ({ page }) => {
  const user = buildUserCredentials('auth-wrong-pw');
  await signUp(page, user);
  await signOut(page);

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/пароль/i).fill('WrongPassword!');
  await page.getByRole('button', { name: /войти/i }).click();

  // Остаёмся на /login и видим ошибку
  await expect(page).toHaveURL('/login');
  await expect(page.locator('body')).toContainText(/неверн|ошибк|invalid/i);
});

test('auth: нельзя зарегистрироваться с уже используемым email', async ({ page }) => {
  const user = buildUserCredentials('auth-dup');
  await signUp(page, user);
  await signOut(page);

  // Попытка регистрации с тем же email
  await page.goto('/register');
  await page.getByLabel(/имя/i).fill('Another Name');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/пароль/i).first().fill(user.password);
  await page.getByRole('button', { name: /зарегистрироваться|создать/i }).click();

  await expect(page.locator('body')).toContainText(/уже|занят|exist/i);
});
