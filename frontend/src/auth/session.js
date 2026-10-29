// Each product owns its session; legacy SSO tokens require server revalidation.
export const sessionToken = () => localStorage.getItem("geraina_token") ||
  (localStorage.getItem("geraina_signed_out") ? null :
    localStorage.getItem("dagangos_token") || localStorage.getItem("dapuros_token"));

export const clearSession = () => {
  const token = localStorage.getItem("geraina_token");
  localStorage.setItem("geraina_signed_out", "1");
  for (const key of ["geraina_token", "geraina_user", "geraina_selected_role"]) localStorage.removeItem(key);
  // Remove a legacy alias only when it belongs to the session being cleared.
  if (token && localStorage.getItem("dagangos_token") === token) {
    localStorage.removeItem("dagangos_token");
    localStorage.removeItem("dagangos_user");
  }
};
