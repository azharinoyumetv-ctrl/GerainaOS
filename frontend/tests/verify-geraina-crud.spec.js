// CRUD menyeluruh Geraina (retail) dalam SATU run: UI form inline + API master-data.
// Retail: tanpa Bahan/BOM. Semua hasil dikumpulkan; satu run melaporkan OK/FAIL.
const { test, expect } = require("@playwright/test");

const STAMP = Date.now();
const EMAIL = `e2e.crud.geraina.${STAMP}@gmail.com`;
const PASSWORD = "Verify123!";
const STORE = `E2E CRUD Toko ${STAMP}`;

const UI_ENTITIES = [
  { label: "UI Kategori", route: "/geraina/app/products/categories", nameLoc: '[data-testid="category-name-input"]', submit: "category-submit", list: "categories-list", extra: [] },
  { label: "UI Merek", route: "/geraina/app/products/brands", nameLoc: '[data-testid="brand-name-input"]', submit: "brand-submit", list: "brands-list", extra: [] },
  { label: "UI Satuan", route: "/geraina/app/products/units", nameLoc: '[data-testid="unit-name-input"]', submit: "unit-submit", list: "units-list", extra: [['[data-testid="unit-symbol-input"]', "e2e"]] },
  { label: "UI Pemasok", route: "/geraina/app/suppliers", nameLoc: '[data-testid="supplier-form"] input[placeholder="Nama PT / Toko Supplier"]', submit: "supplier-submit", list: "suppliers-list", extra: [] },
  { label: "UI Pelanggan", route: "/geraina/app/customers", nameLoc: '[data-testid="customer-form"] input[placeholder="Contoh: Budi Gunawan"]', submit: "customer-submit", list: "customers-list", extra: [] },
];

const API_ENTITIES = [
  { label: "API Produk", base: "/api/products", deletable: true, mk: (n) => ({ name: n, price: 15000, cost: 5000, stock: 5, category: "Umum", unit: "pcs" }) },
  { label: "API Kategori", base: "/api/products/categories", deletable: true, mk: (n) => ({ name: n, description: "e2e" }) },
  { label: "API Merek", base: "/api/products/brands", deletable: true, mk: (n) => ({ name: n, description: "e2e" }) },
  { label: "API Satuan", base: "/api/products/units", deletable: true, mk: (n) => ({ name: n, short_name: "e2e" }) },
  { label: "API Pemasok", base: "/api/suppliers", deletable: true, mk: (n) => ({ name: n, phone: "0811", email: "e2e@x.com", address: "-" }) },
  { label: "API Pelanggan", base: "/api/customers", deletable: true, mk: (n) => ({ name: n, phone: "0811" }) },
  { label: "API Membership", base: "/api/customers/memberships", deletable: false, mk: (n) => ({ name: n, min_points: 100, discount_percent: 5 }) },
  { label: "API Staf", base: "/api/staff", deletable: true, mk: (n) => ({ name: n, email: `e2e.staff.${Date.now()}@gmail.com`, role: "Cashier", phone: "0811", status: "Aktif" }) },
  { label: "API Cabang", base: "/api/branches", deletable: true, mk: (n) => ({ name: n, address: "-", phone: "0811" }) },
];

function asArray(j) {
  return Array.isArray(j) ? j : (j && (j.items || j.data)) || [];
}

// Explicit timeouts here used to be 15000/30000, which silently overrode the
// config's expect.timeout default (config-level timeout only applies when a call
// site doesn't pass its own timeout option) -- so bumping the config alone did
// nothing for these assertions. Bumped to 45000 directly at each call site instead.
async function uiCrud(page, e, results) {
  const name = `E2E ${e.label} ${Date.now()}`;
  const name2 = `${name} EDIT`;
  try {
    await page.goto(e.route);
    await expect(page.locator(`[data-testid="${e.list}"]`)).toBeVisible({ timeout: 45000 });
    await page.fill(e.nameLoc, name);
    for (const [sel, val] of e.extra) await page.fill(sel, val);
    await page.click(`[data-testid="${e.submit}"]`);
    await expect(page.locator(`[data-testid="${e.list}"]`)).toContainText(name, { timeout: 45000 });

    await page.locator(`[data-testid="${e.list}"] tr`, { hasText: name }).locator('button[title="Edit"]').click();
    await page.fill(e.nameLoc, name2);
    await page.click(`[data-testid="${e.submit}"]`);
    await expect(page.locator(`[data-testid="${e.list}"]`)).toContainText(name2, { timeout: 45000 });

    await page.locator(`[data-testid="${e.list}"] tr`, { hasText: name2 }).locator('button[title="Hapus"]').click();
    await expect(page.locator(`[data-testid="${e.list}"] tr`, { hasText: name2 })).toHaveCount(0, { timeout: 45000 });
    results.push(`OK    ${e.label} (C/R/U/D)`);
  } catch (err) {
    results.push(`FAIL  ${e.label}: ${String(err.message).split("\n")[0]}`);
  }
}

async function apiCrud(request, headers, e, results) {
  const name = `E2E ${e.label} ${Date.now()}`;
  try {
    const c = await request.post(e.base, { headers, data: e.mk(name) });
    if (!c.ok()) throw new Error(`create ${c.status()} ${(await c.text()).slice(0, 120)}`);
    const created = await c.json().catch(() => ({}));

    let list = asArray(await (await request.get(e.base, { headers })).json());
    const found = list.find((x) => x.id === created.id || x.name === name);
    if (!found) throw new Error("tidak muncul di list setelah create");
    const id = created.id || found.id;

    if (e.deletable) {
      const d = await request.delete(`${e.base}/${id}`, { headers });
      if (!d.ok()) throw new Error(`delete ${d.status()}`);
      list = asArray(await (await request.get(e.base, { headers })).json());
      if (list.some((x) => x.id === id)) throw new Error("masih ada setelah delete");
      results.push(`OK    ${e.label} (create/read/delete)`);
    } else {
      results.push(`OK    ${e.label} (create/read; tanpa delete)`);
    }
  } catch (err) {
    results.push(`FAIL  ${e.label}: ${String(err.message).split("\n")[0]}`);
  }
}

test("Geraina — CRUD menyeluruh (UI + API)", async ({ page, request }) => {
  test.setTimeout(360_000);
  page.on("dialog", (d) => d.accept());

  await test.step("Register akun", async () => {
    await page.goto("/geraina/register");
    await page.fill('[data-testid="register-store-input"]', STORE);
    await page.fill('[data-testid="register-email-input"]', EMAIL);
    await page.fill('[data-testid="register-password-input"]', PASSWORD);
    await page.click('[data-testid="register-submit-btn"]');
    await expect(page).toHaveURL(/\/geraina\/app\/dashboard/, { timeout: 45000 });
  });

  const token = await page.evaluate(() =>
    localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token")
  );
  const headers = { Authorization: `Bearer ${token}`, "X-DagangOS-Module": "geraina", "Content-Type": "application/json" };

  const results = [];
  for (const e of UI_ENTITIES) await uiCrud(page, e, results);
  for (const e of API_ENTITIES) await apiCrud(request, headers, e, results);

  console.log("\n===== HASIL CRUD Geraina =====\n" + results.join("\n") + "\n==============================\n");
  const failed = results.filter((r) => r.startsWith("FAIL"));
  expect(failed, `Entitas gagal:\n${failed.join("\n")}`).toEqual([]);
});
