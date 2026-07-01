<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


<!-- BEGIN:propdao-debug-prompt -->
## Standing debug prompt — PropDAO system

Use this whenever investigating a bug, auditing for exploits, or before
making changes anywhere in the PropDAO system (this repo, propdao-next-terminal,
and the shared Supabase project `jnjlpcsoxvgeiqfozlqf`). It encodes context
that isn't visible from any single file.

### System shape
- Two separate Next.js apps share one Supabase project: **propdao-auth**
  (this repo — marketplace, challenge purchase, account dashboard) and
  **propdao-next-terminal** (the actual trading UI). They do not share a
  codebase or a runtime session by default.
- Both wallet sign-in and Google sign-in resolve to a **real Supabase Auth
  user (`auth.users.id`, a uuid)**. Wallet sign-in does this via a
  deterministic email `${address}@wallet.propdao.local` with
  `user_metadata.wallet_address` set (see `src/lib/auth.ts`
  `walletPasswordFallback`, and propdao-next-terminal's
  `/api/auth/wallet` + `/api/auth/supabase`). Downstream code in the terminal
  ends up with that uuid as its session identity even for wallet logins —
  don't assume "address" fields are Ethereum addresses past the sign-in step.
- Tester/paper accounts in the terminal hold no real value and intentionally
  skip auth entirely — don't "fix" them into requiring it.

### The trust boundary that matters most
Anything a paying user's account is worth — starting balance, profit target,
max drawdown, which challenge it belongs to — must be **re-derived
server-side from `challenges.rules` and `user_challenges`**, never accepted
from a request body. This was the root cause of the `initAccount` exploit
fixed in propdao-next-terminal in 2026-06: a financial parameter was read
straight off the client's JSON body and trusted, editable from the browser
console with no special tooling. Check every mutation endpoint in both repos
for this pattern, not just trading-specific ones — enrollment
(`enrollChallenge` / `/api/accounts`) is equally exposed.

### Known sharp edges (check these first)
1. **`user_challenges.account_id` can be null** on rows created before the
   account_id-generation feature existed (`enrollChallenge` in
   `src/lib/challenges.ts` generates one now; older rows may not have it).
   Anything that joins on `account_id` should handle null gracefully or
   backfill, not assume it's always populated.
2. **RLS policies on `challenges`** have historically allowed
   unauthenticated/any-role INSERT/UPDATE (`Anyone can upsert challenges`,
   added so the client-side catalog upsert in `enrollChallenge` works without
   a service-role key). Re-check `pg_policies` before assuming the catalog is
   read-only to users — and before tightening it, confirm nothing legitimate
   still relies on the client-side upsert.
3. **Identity type mismatches**: `user_challenges.user_id` is `uuid`. Any
   code (in either repo) that writes a raw wallet address string into it, or
   joins a `text` column against it, will fail or silently no-op. Grep for
   raw address usage in DB calls and confirm it's been resolved to the real
   auth user id first.
4. **Two persistence systems for trading state have existed at once** in
   propdao-next-terminal (`sim_accounts` vs `prop_account_states`). If a
   change in this repo needs to read live account state, confirm via
   `Supabase:list_tables` which one is actually current before assuming.

### How to verify a fix actually matters
Don't reason about exploitability or impact from code alone — query the live
data (`Supabase:execute_sql` against `jnjlpcsoxvgeiqfozlqf`) to see who is
actually affected before and after a change. Several issues in this system
have turned out to affect 0 real users, and at least one affected exactly 1
(a single real customer with 7 paid challenges, the only one with meaningful
purchase history at the time). Check who's affected before assuming
severity, and re-check after a fix lands — a correct security fix can still
accidentally lock out a real, paying account if an identity-bridging gap
between the two apps isn't accounted for.
<!-- END:propdao-debug-prompt -->
