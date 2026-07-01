-- PropDAO Discount Schema
-- Run in Supabase SQL editor after affiliate-schema.sql (if using affiliates).

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT        NOT NULL,
  type                TEXT        NOT NULL CHECK (type IN ('pct', 'flat')),
  value               FLOAT8      NOT NULL CHECK (value > 0),
  max_uses            INT,
  uses_count          INT         NOT NULL DEFAULT 0,
  min_challenge_price FLOAT8,
  challenge_ids       TEXT[],
  valid_from          TIMESTAMPTZ,
  valid_until         TIMESTAMPTZ,
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_code_unique ON discounts (UPPER(code));

CREATE TABLE IF NOT EXISTS discount_uses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id  UUID        NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT        NOT NULL,
  used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discount_id, user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_uses_uid ON discount_uses (user_id);

-- ─── RLS — zero client access ─────────────────────────────────────────────────

ALTER TABLE discounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_uses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discounts_no_client"     ON discounts;
DROP POLICY IF EXISTS "discount_uses_no_client" ON discount_uses;

CREATE POLICY "discounts_no_client"     ON discounts     FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "discount_uses_no_client" ON discount_uses FOR ALL USING (false) WITH CHECK (false);

-- ─── Atomic purchase RPC ──────────────────────────────────────────────────────
-- Row-level lock prevents concurrent purchases from double-spending a
-- limited-use code. Runs SECURITY DEFINER so clients can never call it
-- with elevated rights on their own -- only the service-role backend does.

CREATE OR REPLACE FUNCTION use_discount_code(
  p_code         TEXT,
  p_user_id      UUID,
  p_challenge_id TEXT,
  p_price        FLOAT8
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           discounts%ROWTYPE;
  v_final_price   FLOAT8;
BEGIN
  SELECT * INTO v_row
  FROM discounts
  WHERE UPPER(code) = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid discount code.');
  END IF;

  IF NOT v_row.active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code is no longer active.');
  END IF;

  IF v_row.valid_from IS NOT NULL AND NOW() < v_row.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code is not yet active.');
  END IF;

  IF v_row.valid_until IS NOT NULL AND NOW() > v_row.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code has expired.');
  END IF;

  IF v_row.max_uses IS NOT NULL AND v_row.uses_count >= v_row.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code has reached its usage limit.');
  END IF;

  IF v_row.min_challenge_price IS NOT NULL AND p_price < v_row.min_challenge_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code does not apply to this challenge.');
  END IF;

  IF v_row.challenge_ids IS NOT NULL AND NOT (p_challenge_id = ANY(v_row.challenge_ids)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code does not apply to this challenge.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM discount_uses
    WHERE discount_id = v_row.id
      AND user_id     = p_user_id
      AND challenge_id = p_challenge_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already used this code.');
  END IF;

  IF v_row.type = 'pct' THEN
    v_final_price := GREATEST(0, ROUND((p_price * (1 - v_row.value / 100.0))::NUMERIC, 2)::FLOAT8);
  ELSE
    v_final_price := GREATEST(0, ROUND((p_price - v_row.value)::NUMERIC, 2)::FLOAT8);
  END IF;

  UPDATE discounts SET uses_count = uses_count + 1 WHERE id = v_row.id;
  INSERT INTO discount_uses (discount_id, user_id, challenge_id)
  VALUES (v_row.id, p_user_id, p_challenge_id);

  RETURN jsonb_build_object(
    'ok',            true,
    'discount_id',   v_row.id,
    'final_price',   v_final_price,
    'type',          v_row.type,
    'value',         v_row.value
  );
END;
$$;
