-- Platform currency moves from Australian dollars to Philippine pesos.
--
-- Only the DEFAULT changes. Existing rows keep the currency they were actually
-- charged in — rewriting them would falsify payment history. If the AUD rows in
-- this database are throwaway test data, delete them rather than relabelling.

ALTER TABLE payments
  ALTER COLUMN currency SET DEFAULT 'PHP';

COMMENT ON COLUMN payments.currency IS
  'ISO 4217 code the payment was made in. Defaults to PHP; historical rows may be AUD.';
