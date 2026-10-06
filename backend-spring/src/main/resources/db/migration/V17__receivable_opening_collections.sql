-- Existing paid status only establishes a carried-forward amount, not a payment date/actor.
-- Never fabricate collection history for historical status-only records.
UPDATE receivables SET collected_amount = amount, opening_collected_amount = amount
WHERE status = '수납완료';
