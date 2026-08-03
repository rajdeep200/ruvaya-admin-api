"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin/api-client";

// Mirrors the transition map in src/app/api/v1/admin/orders/[id]/status/route.ts —
// keep the two in sync if the order lifecycle changes.
const TRANSITIONS: Record<string, string[]> = {
  PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SOURCING", "READY_TO_SHIP", "CANCELLED"],
  SOURCING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED", "PARTIALLY_REFUNDED"],
};

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending payment",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  SOURCING: "Sourcing",
  READY_TO_SHIP: "Ready to ship (dispatched)",
  SHIPPED: "Shipped / out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

export function OrderStatusControl({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const options = TRANSITIONS[currentStatus] ?? [];
  const [nextStatus, setNextStatus] = useState(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // currentStatus changes after a successful update (router.refresh()) without
  // remounting this component, so re-sync the selected option and options list.
  useEffect(() => {
    setNextStatus((TRANSITIONS[currentStatus] ?? [])[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus]);

  if (options.length === 0) {
    return (
      <p className="muted">
        {currentStatus === "PENDING_PAYMENT" || currentStatus === "PAYMENT_PENDING"
          ? "Status is controlled by payment processing and updates automatically once payment completes."
          : "This order has no further status changes available."}
      </p>
    );
  }

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Please enter a reason (at least 3 characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      setReason("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="toggle-row status-control">
      <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
        {options.map((status) => (
          <option key={status} value={status}>
            {LABELS[status] ?? status}
          </option>
        ))}
      </select>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for this change"
      />
      <button type="button" className="btn" disabled={busy} onClick={submit}>
        {busy ? "Updating…" : "Update status"}
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
