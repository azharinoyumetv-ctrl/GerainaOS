// Verifikasi menyeluruh Geraina (retail) — setiap halaman/modul harus render.
// expect.soft: satu run melaporkan SEMUA halaman yang gagal sekaligus.
const { test, expect } = require("@playwright/test");

const STAMP = Date.now();
const EMAIL = `e2e.geraina.${STAMP}@gmail.com`;
const PASSWORD = "Verify123!";
const STORE = `E2E Toko Full ${STAMP}`;

const ROUTES = [
  ["/geraina/app/dashboard", "dashboard-page"],
  ["/geraina/app/pos", "pos-page"],
  ["/geraina/app/products", "products-page"],
  ["/geraina/app/products/categories", "categories-page"],
  ["/geraina/app/products/brands", "brands-page"],
  ["/geraina/app/products/units", "units-page"],
  ["/geraina/app/products/stock-adjustment", "stock-adjustment-page"],
  ["/geraina/app/products/stock-transfer", "stock-transfer-page"],
  ["/geraina/app/inventory/overview", "stock-overview-page"],
  ["/geraina/app/inventory/movement", "stock-movement-page"],
  ["/geraina/app/inventory/valuation", "inventory-valuation-page"],
  ["/geraina/app/inventory/low-stock", "low-stock-page"],
  ["/geraina/app/inventory/dead-stock", "dead-stock-page"],
  ["/geraina/app/purchase/orders", "purchase-orders-page"],
  ["/geraina/app/purchase/receiving", "goods-receiving-page"],
  ["/geraina/app/purchase/invoices", "supplier-invoice-page"],
  ["/geraina/app/suppliers", "suppliers-page"],
  ["/geraina/app/customers", "customers-page"],
  ["/geraina/app/customers/membership", "membership-page"],
  ["/geraina/app/customers/loyalty", "loyalty-page"],
  ["/geraina/app/debt/receivable", "receivables-page"],
  ["/geraina/app/debt/payable", "payables-page"],
  ["/geraina/app/payments/cash", "payment-config-page"],
  ["/geraina/app/reports/sales", "reports-page"],
  ["/geraina/app/reports/product", "reports-page"],
  ["/geraina/app/reports/inventory", "reports-page"],
  ["/geraina/app/reports/profit", "reports-page"],
  ["/geraina/app/reports/cashflow", "reports-page"],
  ["/geraina/app/reports/tax", "reports-page"],
  ["/geraina/app/staff/management", "staff-page"],
  ["/geraina/app/staff/roles", "roles-page"],
  ["/geraina/app/staff/permissions", "permissions-page"],
  ["/geraina/app/staff/attendance", "attendance-page"],
  ["/geraina/app/branches", "branches-page"],
  ["/geraina/app/integrations/xendit", "integrations-page"],
  ["/geraina/app/settings/general", "settings-page"],
  ["/geraina/app/settings/license", "license-management-area"],
  ["/geraina/app/sales", "sales-page"],
  ["/geraina/app/license", "license-page"],
  ["/geraina/app/about", "about-page"],
];

test("Geraina — semua halaman/modul render", async ({ page }) => {
  test.setTimeout(240_000);

  await test.step("Register akun Geraina baru", async () => {
    await page.goto("/geraina/register");
    await page.fill('[data-testid="register-store-input"]', STORE);
    await page.fill('[data-testid="register-email-input"]', EMAIL);
    await page.fill('[data-testid="register-password-input"]', PASSWORD);
    await page.click('[data-testid="register-submit-btn"]');
    const errEl = page.locator('[data-testid="register-error"]');
    await Promise.race([
      page.waitForURL(/\/geraina\/app\/dashboard/, { timeout: 30000 }).catch(() => null),
      errEl.waitFor({ state: "visible", timeout: 30000 }).catch(() => null),
    ]);
    if ((await errEl.count()) > 0 && (await errEl.isVisible())) {
      throw new Error("Register gagal: " + (await errEl.textContent()));
    }
    await expect(page).toHaveURL(/\/geraina\/app\/dashboard/, { timeout: 30000 });
  });

  for (const [path, tid] of ROUTES) {
    await page.goto(path);
    await expect
      .soft(page.locator(`[data-testid="${tid}"]`).first(), `${path} -> [data-testid=${tid}]`)
      .toBeVisible({ timeout: 15000 });
  }
});
