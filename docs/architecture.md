# NeoBank architecture diagrams

Mermaid source, rendered inline by GitHub.


### System architecture

```mermaid
flowchart TB
    subgraph browser["Browser"]
        UI["React 19 client components<br/>Tailwind, shadcn/ui, TanStack Query"]
    end

    subgraph server["Next.js 16 App Router server"]
        PROXY["proxy.ts<br/>session refresh, route guard"]
        RSC["Server components<br/>dashboard, transfers, cards, admin"]
        API["Route handlers<br/>zod validation, rate limit, idempotency key"]
        HOOK["Webhook handlers<br/>signature verify, replay dedupe"]
        XFER["lib/transfer-utils.ts<br/>P2P and ACH orchestration, limits, review"]
        LEDGER["lib/ledger.ts<br/>the only app code that moves a balance"]
    end

    subgraph data["Data"]
        PRISMA["Prisma Client<br/>Decimal end to end"]
        PG[("Postgres<br/>numeric 19,4, CHECK constraints,<br/>RLS policies, unique keys")]
    end

    subgraph ext["External providers, test mode and sandbox only"]
        AUTH["Supabase Auth"]
        STRIPE["Stripe Identity and Issuing"]
        PLAID["Plaid Link and Transfer"]
    end

    UI --> PROXY
    UI --> API
    PROXY --> RSC
    PROXY --> AUTH
    API --> AUTH
    API --> XFER
    API --> STRIPE
    API --> PLAID
    HOOK --> XFER
    XFER --> LEDGER
    RSC --> PRISMA
    LEDGER --> PRISMA
    PRISMA --> PG
    STRIPE -.->|"signed webhook"| HOOK
    PLAID -.->|"signed webhook"| HOOK
```

### P2P transfer: the atomic guarded update

The point of this diagram is the two `UPDATE` statements inside the transaction.
The debit carries its own balance predicate, so a concurrent transfer that would overdraw the account matches zero rows and the whole transaction rolls back.

```mermaid
sequenceDiagram
    autonumber
    actor U as Sender
    participant API as POST /api/transfers/p2p
    participant XFER as transfer-utils
    participant LED as ledger.postDoubleEntry
    participant DB as Postgres

    U->>API: POST body plus Idempotency-Key header
    API->>API: supabase.auth.getUser
    API->>API: rate limit, 10 per minute per user
    API->>API: zod parse, amount becomes Decimal

    API->>XFER: executeP2PTransfer

    XFER->>DB: SELECT Transaction WHERE idempotencyKey
    alt key already used
        DB-->>XFER: existing transaction
        XFER-->>API: replayed true, no money moves
        API-->>U: 200 with the original transaction
    else new key
        XFER->>DB: KYC, recipient lookup, limits, advisory balance read
        Note over XFER,DB: This balance read is for the error message only.<br/>It is stale the moment it returns.

        rect rgb(235, 245, 235)
            XFER->>DB: BEGIN
            XFER->>DB: INSERT Transaction with unique idempotencyKey
            XFER->>LED: postDoubleEntry

            LED->>DB: UPDATE Account SET balance = balance - amount<br/>WHERE id = sender AND balance >= amount
            alt zero rows matched
                DB-->>LED: P2025
                LED-->>XFER: InsufficientFundsError
                XFER->>DB: ROLLBACK
                XFER-->>API: failed, insufficient funds
            else one row matched
                DB-->>LED: new sender balance
                LED->>DB: UPDATE Account SET balance = balance + amount<br/>WHERE id = recipient
                DB-->>LED: new recipient balance
                LED->>DB: INSERT LedgerEntry DEBIT, sender, balanceAfter
                LED->>DB: INSERT LedgerEntry CREDIT, recipient, balanceAfter
                LED-->>XFER: both balances after
                XFER->>DB: COMMIT
                XFER-->>API: completed
            end
        end

        API-->>U: 200 with transaction and both ledger entries
    end
```

Two notes the diagram cannot carry.

If a second request with the same idempotency key arrives while the first is still in flight, both pass the initial lookup and one loses on the unique index with `P2002`.
The loser re-reads by key and returns the winner's transaction as a replay, so exactly one transfer exists and both callers see success.

Transfers at or above `PENDING_REVIEW_THRESHOLD` skip `postDoubleEntry` entirely and land as `PENDING`.
No ledger entries exist until an admin approves, and the guarded update above runs at approval time instead, against whatever the balance is then.

### Webhook verification and replay dedupe

```mermaid
sequenceDiagram
    autonumber
    participant P as Plaid
    participant H as POST /api/webhooks/plaid
    participant V as plaid-webhook-verification
    participant DB as Postgres
    participant S as ACH settlement

    P->>H: POST with Plaid-Verification JWT
    H->>H: read raw body bytes, do not parse yet
    Note over H: Parsing and re-serializing changes key order<br/>and whitespace, and the body hash would not match.

    H->>V: verify token against raw body
    V->>V: 1. decode header, require alg ES256
    V->>P: 2. fetch public JWK for kid, cached
    V->>V: 3. verify signature
    V->>V: 4. reject if iat older than 5 minutes
    V->>V: 5. compare request_body_sha256 to SHA-256 of raw body

    alt any check fails
        V-->>H: not verified plus reason
        H-->>P: 401
    else verified
        V-->>H: verified
        H->>DB: INSERT ProcessedWebhookEvent ON CONFLICT DO NOTHING
        alt row already existed
            DB-->>H: 0 rows
            H-->>P: 200 duplicate ignored
            Note over H,P: A non-2xx here would make Plaid<br/>retry the duplicate forever.
        else claim won
            DB-->>H: 1 row
            H->>S: updateACHTransferStatus

            S->>DB: UPDATE ACHTransfer SET status<br/>WHERE id = x AND status NOT IN terminal states
            alt zero rows, already terminal
                DB-->>S: ignore, settlement already posted
            else claimed
                S->>DB: UPDATE Transaction status
                opt status is COMPLETED
                    S->>DB: postDoubleEntry against ACH settlement house account
                end
            end

            alt handler threw before committing anything
                H->>DB: DELETE the claim so Plaid can retry
                H-->>P: 500
            else success
                H-->>P: 200
            end
        end
    end
```

Stripe's Identity and Issuing handlers follow the same shape.
Verification is `stripe.webhooks.constructEvent` against a per-endpoint signing secret, and the dedupe claim uses Stripe's own `event.id` scoped to the provider, so a Stripe event id and a Plaid event id can never collide.

---

