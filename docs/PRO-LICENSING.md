# LocalDrop Pro — Crypto Payments

## Payment provider: NOWPayments

LocalDrop uses **[NOWPayments](https://nowpayments.io)** to accept crypto without building blockchain infrastructure yourself.

| Supported | Examples |
|-----------|----------|
| Bitcoin | BTC |
| Ethereum | ETH |
| Stablecoins | USDT (TRC20/ERC20), USDC |
| Altcoins | LTC, SOL, DOGE, and 100+ more |

**Fees:** ~0.5–1% NOWPayments fee + network gas (paid by customer).

**No card payments.** No Lemon Squeezy. No PayPal.

---

## Customer flow

```
1. Upgrade to Pro → Pay with Crypto
2. Enter email + pick coin (BTC, ETH, USDT…)
3. Send exact amount to the address shown (QR code included)
4. Blockchain confirms → activation link sent to email
5. Click link → Pro unlocked on device
```

License is **never** sent in email — same secure activation as before.

---

## Seller setup (one-time)

### 1. Create NOWPayments account

1. Sign up at [nowpayments.io](https://nowpayments.io)
2. Complete verification
3. Add your **payout wallet** (where you receive funds)
4. Copy **API Key** and **IPN Secret** from Settings → API

### 2. Deploy API to Vercel

Set environment variables:

| Variable | Value |
|----------|--------|
| `NOWPAYMENTS_API_KEY` | From NOWPayments dashboard |
| `NOWPAYMENTS_IPN_SECRET` | From NOWPayments dashboard |
| `SITE_URL` | `https://yourdomain.com` |
| `CRYPTO_PRICE_USD` | `9` (or your price) |
| `LICENSE_PRIVATE_KEY` | Contents of `scripts/keys/private.pem` |
| `ACTIVATION_SECRET` | Random 32+ char string |
| `RESEND_API_KEY` | For activation emails |

### 3. Configure IPN webhook in NOWPayments

Set IPN callback URL to:

```
https://yourdomain.com/api/crypto-webhook
```

This marks payments as confirmed when the blockchain confirms.

---

## Your seller dashboard

| Task | Where |
|------|--------|
| View crypto payments | [NOWPayments Dashboard](https://account.nowpayments.io) → Payments |
| Payouts to your wallet | NOWPayments → Payouts |
| API keys | NOWPayments → Settings → API |

There is no seller page inside LocalDrop — NOWPayments is your payment dashboard.

---

## Local development

```bash
npm run license:keys   # once
npm run dev:api        # terminal 1
npm run dev            # terminal 2
```

Open `/pay.html` → use **Dev: simulate payment** (no real crypto needed).

---

## Security

- Payment verified on-chain via NOWPayments API
- Activation link (not license) sent by email
- License signed with Ed25519, bound to device ID
- IPN webhook signature verified with `NOWPAYMENTS_IPN_SECRET`

---

## Manual support fallback

If a customer paid but email failed:

```bash
npm run license:generate -- --device LD-their-device-id --lifetime --email customer@email.com
```

See [SELLER-GUIDE.md](SELLER-GUIDE.md) for full seller workflow.

---

## Alternatives to NOWPayments

| Provider | Best for |
|----------|----------|
| **BTCPay Server** | Self-hosted, zero fees, more setup |
| **Coinbase Commerce** | US-focused, simple API |
| **Direct wallet** | Manual verification only — not recommended |

To swap providers, edit `api/lib/crypto.js`.
