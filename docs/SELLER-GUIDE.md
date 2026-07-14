# LocalDrop — Seller Guide (Crypto)

## Your dashboards

| What | Where |
|------|--------|
| **Crypto payments & revenue** | [NOWPayments Dashboard](https://account.nowpayments.io) |
| **Payouts to your wallet** | NOWPayments → Payouts |
| **Activation emails** | [Resend Dashboard](https://resend.com/emails) |
| **App hosting** | [Vercel Dashboard](https://vercel.com/dashboard) |

There is **no seller page inside LocalDrop**. You manage everything from NOWPayments.

---

## Per-order workflow (fully automatic)

You do **nothing** per customer:

1. Customer pays crypto on `/pay.html`
2. NOWPayments confirms on-chain
3. Webhook marks email as paid
4. Customer gets activation link
5. Pro unlocked on their device

---

## When you need to intervene (rare)

| Issue | Fix |
|-------|-----|
| Payment stuck | Check NOWPayments → Payments |
| Wrong email | Customer pays again with correct email, or manual license |
| Email not received | `npm run license:generate -- --device LD-xxx --lifetime` |

---

## Getting paid

NOWPayments sends crypto to your configured payout wallet. Set it in:

**NOWPayments → Settings → Payout wallets**

Choose BTC, ETH, USDT, or whatever you prefer.

---

## Launch checklist

- [ ] NOWPayments account verified
- [ ] Payout wallet configured
- [ ] API key + IPN secret in Vercel env vars
- [ ] IPN URL: `https://yourdomain.com/api/crypto-webhook`
- [ ] Resend configured for activation emails
- [ ] `npm run license:keys` done, private key in Vercel
- [ ] Test with small real payment before announcing
