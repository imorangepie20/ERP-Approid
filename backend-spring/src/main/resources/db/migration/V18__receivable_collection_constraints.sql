-- Stop migration on inconsistent old amounts; do not silently repair financial documents.
ALTER TABLE receivables ADD CONSTRAINT chk_receivable_collection_balance
    CHECK (amount >= 0 AND opening_collected_amount >= 0
           AND collected_amount >= opening_collected_amount AND collected_amount <= amount);
ALTER TABLE receivables ADD CONSTRAINT chk_receivable_collected_status
    CHECK (status <> '수납완료' OR collected_amount = amount);
