// Navigation reflects server-assigned roles. This never grants API permissions.
export const ROLES = ["Owner", "Manager", "Cashier", "Warehouse"];
export function canonicalRole(role) {
  if (typeof role !== "string") return null;
  return { owner: "Owner", admin: "Owner", manager: "Manager", cashier: "Cashier", warehouse: "Warehouse" }[role.trim().toLowerCase()] || null;
}
export const canManageStaff = role => canonicalRole(role) === "Owner";
export const canManageProducts = role => ["Owner", "Manager"].includes(canonicalRole(role));
export const canViewTeamAttendance = role => ["Owner", "Manager"].includes(canonicalRole(role));

export const ROLE_MODULES = {
  Owner: ["*"],
  Manager: ["dashboard", "pos", "kds", "products", "inventory", "purchase", "suppliers", "customers", "debt", "reports", "sales", "staff", "attendance", "about"],
  Cashier: ["dashboard", "pos", "kds", "products", "customers", "sales", "attendance", "about"],
  Warehouse: ["products", "ingredients", "inventory", "purchase", "suppliers", "attendance", "about"],
};

const ownerPaths = ["/staff/roles", "/staff/permissions", "/settings", "/integrations", "/payments", "/branches", "/billing", "/license"];
export function canAccessPath(role, pathname) {
  role = canonicalRole(role);
  if (!role) return false;
  const path = pathname.replace(/^\/geraina\/app/, "").replace(/\/$/, "") || "/dashboard";
  const matches = prefix => path === prefix || path.startsWith(prefix + "/");
  if (role === "Owner") return true;
  if (matches("/staff/attendance")) return canViewTeamAttendance(role);
  if (ownerPaths.some(matches)) return false;
  if (["/products/categories", "/products/brands", "/products/units"].some(matches)) return canManageProducts(role);
  if (["/products/stock-adjustment", "/products/stock-transfer"].some(matches)) return ["Manager", "Warehouse"].includes(role);
  return ROLE_MODULES[role].includes(path.split("/")[1]);
}

export function firstAllowedPath(role) {
  const assigned = canonicalRole(role);
  if (assigned === "Warehouse") return "/geraina/app/inventory/overview";
  return assigned === "Cashier" ? "/geraina/app/pos" : "/geraina/app/dashboard";
}
