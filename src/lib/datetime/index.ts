// Server Components render with the process's default timezone (UTC on
// Vercel), not India's. Pin every admin-panel timestamp to IST explicitly
// rather than relying on the server's default, which is what was showing
// admins UTC times with no indication they weren't local.
const IST = "Asia/Kolkata";
export function formatIst(date: Date): string { return date.toLocaleString("en-IN", { timeZone: IST }); }
export function formatIstDate(date: Date): string { return date.toLocaleDateString("en-IN", { timeZone: IST }); }
