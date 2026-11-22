DO $$
BEGIN
  IF to_regclass('public.billing_payments') IS NULL THEN
    RAISE EXCEPTION 'No existe billing_payments; aplica primero el esquema base.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_payments
    WHERE provider_tx_id IS NOT NULL
    GROUP BY provider, provider_tx_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay transacciones de proveedor duplicadas en billing_payments. Concilia y documenta los registros antes de aplicar 0014_billing_provider_tx_unique.sql.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_provider_tx_unique_idx
  ON public.billing_payments (provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;
