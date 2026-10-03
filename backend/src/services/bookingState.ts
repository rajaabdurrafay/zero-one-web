const transitions:Record<string,string[]>={
  PENDING:['PENDING_PAYMENT','AWAITING_VERIFICATION','CONFIRMED','REJECTED','CANCELLED'],
  PENDING_PAYMENT:['AWAITING_VERIFICATION','CONFIRMED','REJECTED','CANCELLED'],
  AWAITING_VERIFICATION:['CONFIRMED','REJECTED','CANCELLED'],
  CONFIRMED:['COMPLETED','CANCELLED'],
  REJECTED:['AWAITING_VERIFICATION','CONFIRMED','CANCELLED'],
  COMPLETED:[],CANCELLED:[],
};
export function assertBookingTransition(from:string,to:string){
  if(from!==to && !transitions[from]?.includes(to))throw Object.assign(new Error(`Booking cannot change from ${from} to ${to}.`),{status:409});
}
