import { expect, test } from '@playwright/test';
import { buildUserCredentials, signOut, signUp } from './fixtures';

test('lobby: правила игры отображаются', async ({ page }) => {
  const user = buildUserCredentials('lobby-rules');
  await signUp(page, user);
  await page.goto('/lobby');

  // Заголовок правил
  await expect(page.getByText(/правила игры/i)).toBeVisible();

  // Ключевые факты из правил
  await expect(page.getByText(/8 секунд/i)).toBeVisible();
  await expect(page.getByText(/10 раундов/i)).toBeVisible();
  await expect(page.getByText(/\+10 очков/i)).toBeVisible();
  await expect(page.getByText(/−5 очков/i)).toBeVisible();
});

test('lobby: можно выбрать размер команды 2×2 и 3×3', async ({ page }) => {
  const user = buildUserCredentials('lobby-size');
  await signUp(page, user);
  await page.goto('/lobby');

  const btn2x2 = page.getByRole('button', { name: '2 × 2' });
  const btn3x3 = page.getByRole('button', { name: '3 × 3' });

  await expect(btn2x2).toBeVisible();
  await expect(btn3x3).toBeVisible();

  await btn3x3.click();
  await expect(btn3x3).toHaveClass(/indigo/);

  await btn2x2.click();
  await expect(btn2x2).toHaveClass(/indigo/);
});

test('lobby: ошибка при вводе несуществующего кода комнаты', async ({ page }) => {
  const user = buildUserCredentials('lobby-badcode');
  await signUp(page, user);
  await page.goto('/lobby');

  const input = page.locator('input[placeholder="ABCD12"]');
  await input.fill('ZZZZZZ');
  await page.getByRole('button', { name: /войти/i }).click();

  // Должна появиться ошибка
  await expect(page.locator('body')).toContainText(/не найден|ошибк/i);
});

test('lobby: незарегистрированный пользователь видит предложение войти', async ({ page }) => {
  await page.goto('/lobby');
  // На странице две ссылки "Войти" (navbar + основной контент) — берём из main
  await expect(page.getByRole('main').getByRole('link', { name: /войти/i })).toBeVisible();
  await expect(page.getByText(/для игры нужно войти/i)).toBeVisible();
});

test('lobby: создание комнаты перебрасывает в игровую страницу', async ({ page }) => {
  const user = buildUserCredentials('lobby-create');
  await signUp(page, user);
  await page.goto('/lobby');

  await page.getByRole('button', { name: /создать$/i }).click();

  // Должны оказаться в /game/<uuid>
  await page.waitForURL(/\/game\/[0-9a-f-]+/, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/game\//);

  // Код комнаты виден
  await expect(page.locator('text=/[A-Z0-9]{6}/')).toBeVisible();
});
