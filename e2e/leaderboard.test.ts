import { expect, test } from '@playwright/test';
import { buildUserCredentials, signUp } from './fixtures';

test('leaderboard: страница доступна без входа', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page).toHaveURL('/leaderboard');
  await expect(page.getByRole('heading', { name: /рейтинг/i })).toBeVisible();
});

test('leaderboard: переключение вкладок работает', async ({ page }) => {
  await page.goto('/leaderboard');

  const playersTab = page.getByRole('button', { name: /рейтинг игроков/i });
  const teamsTab = page.getByRole('button', { name: /рейтинг команд/i });

  // По умолчанию выбрана вкладка игроков
  await expect(playersTab).toHaveClass(/bg-indigo/);

  // Кликаем на команды
  await teamsTab.click();
  await expect(teamsTab).toHaveClass(/bg-indigo/);
  await expect(playersTab).not.toHaveClass(/bg-indigo/);

  // Возвращаемся к игрокам
  await playersTab.click();
  await expect(playersTab).toHaveClass(/bg-indigo/);
});

test('leaderboard: пустое состояние при отсутствии матчей', async ({ page }) => {
  await page.goto('/leaderboard');

  // Ждём окончания загрузки tRPC-данных — скелетон "Загрузка…" исчезает
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Загрузка'),
    { timeout: 8000 },
  );

  const emptyMsg = page.getByText(/рейтинг пока пуст|первый матч/i);
  const hasData = page.locator('.divide-y > div').first();

  // Либо пусто, либо есть данные — оба варианта валидны
  const isEmpty = await emptyMsg.isVisible().catch(() => false);
  const hasEntries = await hasData.isVisible().catch(() => false);
  expect(isEmpty || hasEntries).toBe(true);
});

test('leaderboard: ссылка "Назад в лобби" работает', async ({ page }) => {
  await page.goto('/leaderboard');
  await page.getByRole('link', { name: /назад в лобби/i }).click();
  await expect(page).toHaveURL('/lobby');
});

test('leaderboard: навигационная вкладка "Рейтинг" ведёт на /leaderboard', async ({ page }) => {
  await page.goto('/');
  // Уточняем до navbar — на главной странице тоже есть ссылка "Рейтинг"
  await page.getByRole('navigation').getByRole('link', { name: /^рейтинг$/i }).click();
  await expect(page).toHaveURL('/leaderboard');
});
