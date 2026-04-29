import { expect, test } from '@playwright/test';
import { buildUserCredentials, signOut, signUp } from './fixtures';

test('stats: неавторизованный пользователь редиректится на /login', async ({ page }) => {
  await page.goto('/stats');
  await expect(page).toHaveURL('/login');
});

test('stats: авторизованный пользователь видит страницу статистики', async ({ page }) => {
  const user = buildUserCredentials('stats-auth');
  await signUp(page, user);

  await page.goto('/stats');
  await expect(page).toHaveURL('/stats');
  await expect(page.getByRole('heading', { name: /статистика/i })).toBeVisible();
});

test('stats: сводные карточки отображаются', async ({ page }) => {
  const user = buildUserCredentials('stats-cards');
  await signUp(page, user);

  await page.goto('/stats');

  // Все 8 карточек должны присутствовать (exact: true чтобы не задеть заголовки "История матчей" и т.п.)
  await expect(page.getByText('Матчей', { exact: true })).toBeVisible();
  await expect(page.getByText('Побед', { exact: true })).toBeVisible();
  await expect(page.getByText('Поражений', { exact: true })).toBeVisible();
  await expect(page.getByText('Точность', { exact: true })).toBeVisible();
  await expect(page.getByText('Всего очков', { exact: true })).toBeVisible();
  await expect(page.getByText('Правильных', { exact: true })).toBeVisible();
  await expect(page.getByText('Ошибок', { exact: true })).toBeVisible();
  await expect(page.getByText('Лучший матч', { exact: true })).toBeVisible();
});

test('stats: у нового игрока история пустая', async ({ page }) => {
  const user = buildUserCredentials('stats-empty');
  await signUp(page, user);

  await page.goto('/stats');
  await expect(page.getByText(/ни одного матча|история пуста/i)).toBeVisible();
});

test('stats: вкладка "Статистика" в навбаре ведёт на /stats', async ({ page }) => {
  const user = buildUserCredentials('stats-nav');
  await signUp(page, user);

  await page.goto('/lobby');
  await page.getByRole('link', { name: /статистика/i }).click();
  await expect(page).toHaveURL('/stats');
});
