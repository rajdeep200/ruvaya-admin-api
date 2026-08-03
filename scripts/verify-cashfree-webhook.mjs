import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);
if (!env.CASHFREE_CLIENT_SECRET) throw new Error("CASHFREE_CLIENT_SECRET is missing from .env");
const baseUrl = process.argv[2] ?? "http://localhost:3001";
const body = JSON.stringify({ data: { test_object: { test_key: "test_value" } }, event_time: new Date().toISOString(), type: "WEBHOOK" });
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", env.CASHFREE_CLIENT_SECRET).update(timestamp + body).digest("base64");
const response = await fetch(`${baseUrl}/api/v1/webhooks/cashfree`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-webhook-timestamp": timestamp, "x-webhook-signature": signature },
  body,
});
console.log(JSON.stringify({ status: response.status, body: await response.json() }));
if (!response.ok) process.exit(1);
