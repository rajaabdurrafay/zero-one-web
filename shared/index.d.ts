export const BUSINESS_TIMEZONE: 'Asia/Karachi';
export interface Rate { pricingUnit: string; basePrice: number; halfHourPrice?: number | null; fullHourPrice?: number | null; }
export interface Discount { discountType: string; discountValue: number; minDuration?: number | null; }
export interface Addon { priceAtBooking: number; quantity: number; }
export interface Snapshot { rate: Rate; offer: Discount | null; }
export function money(value: number): number;
export function activityPrice(rate: Rate, minutes: number): number;
export function quote(rate: Rate, minutes: number, offer?: Discount | null, addons?: Addon[]): { originalPrice: number; discountAmount: number; addonsTotal: number; payablePrice: number; };
export function elapsedSeconds(session: { startedAt: Date | string; endedAt?: Date | string | null; status: string; pausedAt?: Date | string | null; totalPausedSeconds?: number; }, now?: number): number;
export function businessDate(value?: Date | string | number): string;
export function businessInstant(date: string, time?: string): Date;
export function canonicalPhone(value: string): string;

export function allocatePayments(total:number,weights:number[]):number[];
export function isSameOriginRequest(request: { url: string; headers: { get(name: string): string | null } }, publicOrigin?: string): boolean;
