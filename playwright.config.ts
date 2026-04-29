import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // игровые тесты зависят от сессий
  retries: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Запускать dev-сервер перед тестами не нужно — запускай вручную
  // webServer: { command: 'npm run dev', url: 'http://localhost:3000' },
});
