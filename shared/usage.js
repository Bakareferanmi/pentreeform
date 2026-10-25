export const USAGE_THRESHOLDS=[80,95];
export function usageSummary(count,limit,month=new Date().toISOString().slice(0,7)){
 const used=Number(count),quota=Number(limit);
 if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(quota)||quota<=0)return null;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return null;
 const [year,number]=month.split('-').map(Number),resetAt=new Date(Date.UTC(year,number,1)).toISOString();
 const level=used>=quota?100:used*100>=quota*95?95:used*100>=quota*80?80:0;
 return {used,limit:quota,remaining:Math.max(0,quota-used),percent:Math.floor(used/quota*100),progress:Math.min(100,used/quota*100),level,month,resetAt};
}
