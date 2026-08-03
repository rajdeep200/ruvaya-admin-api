export type MoneyDto = { amount: number; currency: "INR" };
export function rupeesToPaise(value: string | number): number { const raw=String(value).trim(); if(!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("Invalid rupee amount"); const [r,p=""] = raw.split("."); const result=Number(r)*100+Number(p.padEnd(2,"0")); if(!Number.isSafeInteger(result)) throw new Error("Amount is out of range"); return result; }
export function paiseToRupees(paise:number): number { if(!Number.isSafeInteger(paise)) throw new Error("Paise must be an integer"); return paise/100; }
export function toMoneyDto(paise:number): MoneyDto { return { amount: paiseToRupees(paise), currency:"INR" }; }
export function percentageDiscount(paise:number,basisPoints:number):number { return Math.floor((paise*basisPoints)/10000); }
export function formatPaise(paise:number):string { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(paiseToRupees(paise)); }
