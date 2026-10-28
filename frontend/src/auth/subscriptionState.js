const names = { trial: "Trial", starter: "Starter", pro: "Pro", business: "Business", expired: "Berakhir" };
const paid = ["starter", "pro", "business"];

// Presentation only: access permissions still come from the authenticated server.
// An unknown value must never be advertised as an active paid package.
export function subscriptionState(value = {}) {
  const sub = value?.subscription;
  const tier = sub ? sub.tier : value?.plan;
  const end = sub?.expires_at || (!sub && ["trial", "expired"].includes(tier) ? value?.trial_ends_at : null);
  const validEnd = typeof end === "string" && Number.isFinite(Date.parse(end));
  const known = Object.prototype.hasOwnProperty.call(names, tier) && (!sub || paid.includes(tier) && validEnd);
  const active = known && (sub ? sub.active === true && sub.status === "active" && Date.parse(end) > Date.now() : tier !== "expired");
  const plan = !known ? "unknown" : sub && !active ? "expired" : tier;
  return {
    plan, known, active,
    label: names[plan] || "Belum diketahui",
    tierLabel: known ? names[tier] : "Belum diketahui",
    expiresAt: known && validEnd ? end : null,
  };
}
