#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.local}"
touch "$ENV_FILE"
cp "$ENV_FILE" "${ENV_FILE}.bak.ensure_keys.$(date +%Y%m%d-%H%M%S)" >/dev/null 2>&1 || true

append_if_missing () {
  local kv="$1"
  local key="${kv%%=*}"
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    printf "\n%s\n" "$kv" >> "$ENV_FILE"
  fi
}

# Базовые (если вдруг каких-то нет, но обычно придут из Vercel env pull)
append_if_missing "NEXT_PUBLIC_APP_URL="
append_if_missing "NEXT_PUBLIC_SUPABASE_URL="
append_if_missing "NEXT_PUBLIC_SUPABASE_ANON_KEY="
append_if_missing "SUPABASE_SERVICE_ROLE_KEY="
append_if_missing "OPENAI_API_KEY="
append_if_missing "N8N_TURBOTA_AGENT_WEBHOOK_URL="

# WayForPay (фиксированный провайдер по ТЗ)
append_if_missing "WAYFORPAY_MERCHANT_ACCOUNT="
append_if_missing "WAYFORPAY_MERCHANT_SECRET_KEY="
append_if_missing "WAYFORPAY_MERCHANT_DOMAIN="
append_if_missing "WAYFORPAY_WEBHOOK_URL="
append_if_missing "WAYFORPAY_RETURN_URL="

# Trial + Promo
append_if_missing "TRIAL_QUESTIONS_LIMIT=5"
append_if_missing "PROMO_DOCTORS_CODE="
append_if_missing "PROMO_DOCTORS_MONTHS=12"

echo "OK: добавил только недостающие ключи. Существующие не трогал."
