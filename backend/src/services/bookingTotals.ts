import { quote, Snapshot, money } from '@zeroone/domain';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
export async function pricingSnapshot(resourceId: string, offerId?: string | null): Promise<Snapshot> {
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId }, select: { type: true } });
  const rate = await prisma.activity.findUniqueOrThrow({ where: { resourceType: resource.type }, select: { pricingUnit:true,basePrice:true,halfHourPrice:true,fullHourPrice:true } });
  const offer = offerId ? await prisma.offer.findUnique({ where: { id: offerId }, select: { discountType:true,discountValue:true,minDuration:true } }) : null;
  return { rate, offer };
}
export async function repriceBooking(booking: { id:string; resourceId:string; appliedOfferId:string|null; pricingSnapshot:Prisma.JsonValue|null; }, minutes:number) {
  const snapshot = booking.pricingSnapshot as unknown as Snapshot || await pricingSnapshot(booking.resourceId, booking.appliedOfferId);
  const addons = await prisma.bookingAddon.findMany({where:{bookingId:booking.id},select:{priceAtBooking:true,quantity:true}});
  const bill = quote(snapshot.rate,minutes,snapshot.offer,addons);
  return { totalPrice:bill.payablePrice,discountAmount:bill.discountAmount,pricingSnapshot:snapshot as unknown as Prisma.InputJsonValue };
}
export async function reconcileGroup(groupId?:string|null) {
  if (!groupId) return;
  const children = await prisma.booking.findMany({where:{bookingGroupId:groupId},select:{totalPrice:true,status:true,amountPaid:true}});
  const allSame = children.length && children.every(child=>child.status===children[0].status);
  await prisma.bookingGroup.update({where:{id:groupId},data:{ totalAmount: money(children.filter(child=>!['CANCELLED','REJECTED'].includes(child.status)).reduce((sum,child)=>sum+child.totalPrice,0)), ...(allSame ? {status:children[0].status}:{}) }});
}
