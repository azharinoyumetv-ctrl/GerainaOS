"""Server permissions; clients can display these capabilities but cannot grant them."""
from fastapi import Depends, HTTPException

EMPLOYEE_ROLES = frozenset({"Manager", "Cashier", "Warehouse"})
ROLE_CAPABILITIES = {
    "Owner": frozenset({"*"}),
    "Manager": frozenset({"dashboard.read", "pos.use", "products.read", "products.write", "inventory.read", "inventory.write", "purchase.read", "purchase.write", "suppliers.read", "suppliers.write", "customers.read", "customers.write", "customers.manage", "debt.read", "debt.write", "reports.read", "reports.write", "sales.read", "staff.read", "attendance.self", "attendance.team"}),
    "Cashier": frozenset({"dashboard.read", "pos.use", "products.read", "customers.read", "customers.write", "sales.read", "attendance.self"}),
    "Warehouse": frozenset({"products.read", "inventory.read", "inventory.write", "purchase.read", "purchase.write", "suppliers.read", "suppliers.write", "attendance.self"}),
}


def canonical_role(value):
    if not isinstance(value, str):
        return None
    return {"owner": "Owner", "admin": "Owner", "manager": "Manager", "cashier": "Cashier", "warehouse": "Warehouse"}.get(value.strip().lower())


def capabilities_for(role):
    return sorted(ROLE_CAPABILITIES.get(canonical_role(role), ()))


def has_permission(user, permission):
    capabilities = ROLE_CAPABILITIES.get(canonical_role(user.get("role")), ())
    return "*" in capabilities or permission in capabilities


def require_roles(*roles):
    from auth import get_current_user
    allowed = {canonical_role(role) for role in roles}
    async def dependency(user: dict = Depends(get_current_user)):
        if canonical_role(user.get("role")) not in allowed:
            raise HTTPException(status_code=403, detail="Peran Anda tidak diizinkan untuk tindakan ini.")
        return user
    return dependency


def require_permission(permission):
    from auth import get_current_user
    async def dependency(user: dict = Depends(get_current_user)):
        if not has_permission(user, permission):
            raise HTTPException(status_code=403, detail="Peran Anda tidak diizinkan untuk tindakan ini.")
        return user
    return dependency
