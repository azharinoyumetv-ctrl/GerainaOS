"""Resolve paid access separately for each product. Keep synced with DapurOS."""
from datetime import datetime, timedelta, timezone


def subscription_for(user, module):
    subscription = (user.get("subscriptions") or {}).get(module)
    if not isinstance(subscription, dict):
        return None
    result = dict(subscription)
    try:
        end = datetime.fromisoformat(result["expires_at"])
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        active = result.get("tier") in ("starter", "pro", "business") and result.get("status") == "active" and end > datetime.now(timezone.utc)
    except (KeyError, ValueError, TypeError):
        active = False
    result["active"] = active
    preference = (user.get("subscription_preferences") or {}).get(module, {})
    stopping = preference.get("order_id") == result.get("order_id") and preference.get("cancel_at_period_end") is True
    result["cancel_at_period_end"] = stopping
    if stopping:
        result["cancel_requested_at"] = preference.get("cancel_requested_at")
    return result


def apply_subscription(user, module):
    result = dict(user)
    result["current_module"] = module
    result.pop("subscription", None)
    subscription = subscription_for(result, module)
    if subscription is not None:
        result["plan"] = subscription["tier"] if subscription["active"] else "expired"
        result["subscription"] = subscription
    return result


def apply_store_subscription(user, store, module):
    # Employees use the paid entitlement of the store they are already authorized
    # to access, without becoming its owner or acquiring billing permissions.
    if store and store.get("owner_user_id") != user["id"] and isinstance(store.get("subscription"), dict):
        user = {**user, "subscriptions": {**(user.get("subscriptions") or {}), module: store["subscription"]}}
    result = apply_subscription(user, module)
    result["trial_ends_at"] = None
    result.pop("trial_expired_at", None)
    if result.get("subscription") is not None:
        return result
    if not store or store.get("module") not in (None, module):
        result["plan"] = "expired"
        return result

    primary = user.get("_account_primary_store_id", user.get("store_id")) == store.get("id")
    # Legacy global plans belong only to the account's original store. A newly
    # activated product must derive access from its own store, never this fallback.
    plan = store.get("plan") or (user.get("plan") if primary else "trial")
    if plan in ("starter", "pro", "business"):
        result["plan"] = plan
        return result
    end = store.get("trial_ends_at")
    if end is None and primary:
        end = user.get("trial_ends_at")
    if end is None and store.get("created_at"):
        try:
            end = (datetime.fromisoformat(store["created_at"]) + timedelta(days=14)).isoformat()
        except (TypeError, ValueError):
            pass
    try:
        expiry = datetime.fromisoformat(end)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        result["trial_ends_at"] = expiry.isoformat()
        result["plan"] = "trial" if plan != "expired" and expiry > datetime.now(timezone.utc) else "expired"
    except (TypeError, ValueError):
        result["plan"] = "expired"
    return result
