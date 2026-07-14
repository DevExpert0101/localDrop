const BASE = `http://localhost:${process.env.LOCALDROP_API_PORT || 3002}`;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

await test("GET currencies", async () => {
  const res = await fetch(`${BASE}/api/create-crypto-payment`);
  const data = await res.json();
  if (!res.ok || !data.currencies?.length) throw new Error(JSON.stringify(data));
});

await test("POST create payment", async () => {
  const res = await fetch(`${BASE}/api/create-crypto-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", payCurrency: "btc" }),
  });
  const data = await res.json();
  if (!res.ok || !data.paymentId) throw new Error(JSON.stringify(data));
});

await test("POST simulate payment", async () => {
  const create = await fetch(`${BASE}/api/create-crypto-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@test.local", payCurrency: "btc" }),
  });
  const payment = await create.json();
  const res = await fetch(`${BASE}/api/check-crypto-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId: payment.paymentId, email: "buyer@test.local", simulate: true }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "finished") throw new Error(JSON.stringify(data));
});

await test("POST request activation", async () => {
  const res = await fetch(`${BASE}/api/request-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@test.local" }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(JSON.stringify(data));
});

await test("App pages load", async () => {
  for (const path of ["/", "/pay.html", "/activate.html"]) {
    const res = await fetch(`http://localhost:5173${path}`);
    if (!res.ok) throw new Error(`${path} => ${res.status}`);
  }
});

console.log("\nAPI tests done.");
