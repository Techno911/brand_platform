import { test, expect } from "@playwright/test";

/**
 * Логин через split layout CHIP_UI_KIT. Проверяет:
 *  - нет ссылки "Зарегистрироваться" (CLAUDE.md)
 *  - sidebar появляется с bg #1A1A1A (CHIP_UI_KIT)
 *  - JWT НЕ сохраняется в localStorage (CLAUDE.md)
 */
test.describe("01 · login", () => {
  test("marketer (Оля) успешно логинится в CHIP_UI_KIT layout", async ({ page }) => {
    await page.goto("/login");

    // Нет "Зарегистрироваться" (CLAUDE.md запрет)
    await expect(page.getByText(/зарегистр/i)).toHaveCount(0);
    // Нет "Забыли пароль?" (CLAUDE.md)
    await expect(page.getByText(/забыли пароль/i)).toHaveCount(0);

    // Логин сид-юзером (используем data-testid, placeholder "••••••••" не матчится regex-ом)
    await page.getByTestId("login-email").fill("olya@chirkov-bp.ru");
    await page.getByTestId("login-password").fill("Test123!");
    await page.getByTestId("login-submit").click();

    // Ждём переход на /dashboard
    await page.waitForURL(/\/dashboard$/);

    // Sidebar виден: bg-[#1A1A1A]
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    const bg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #1A1A1A = rgb(26, 26, 26)
    expect(bg).toBe("rgb(26, 26, 26)");

    // JWT не в localStorage
    const accessInStorage = await page.evaluate(() => localStorage.getItem("access_token"));
    expect(accessInStorage).toBeNull();
  });
});
