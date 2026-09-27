function numeric(value){return typeof value==='number'&&Number.isFinite(value)?value:undefined;}
function normalizeStats(data,name='CRS'){
  if(!data||typeof data!=='object'||!data.limits)throw new Error('CRS 统计格式不匹配');
  const l=data.limits,u=data.usage?.total||{};
  const dailyUsed=numeric(l.currentDailyCost),dailyLimit=numeric(l.dailyCostLimit);
  const totalUsed=numeric(l.currentTotalCost),totalLimit=numeric(l.totalCostLimit);
  const windows=[];
  if(dailyLimit>0&&dailyUsed!==undefined)windows.push({label:'今日',used:dailyUsed,limit:dailyLimit});
  if(totalLimit>0&&totalUsed!==undefined)windows.push({label:'累计',used:totalUsed,limit:totalLimit});
  const percent=windows.length?Math.max(...windows.map(w=>Math.max(0,Math.min(100,w.used/w.limit*100)))):undefined;
  const money=n=>'$'+n.toFixed(4);
  const rows=[];
  if(dailyUsed!==undefined)rows.push('今日 '+money(dailyUsed)+(dailyLimit>0?' / '+money(dailyLimit):'（未设日限额）'));
  if(totalUsed!==undefined)rows.push('累计 '+money(totalUsed)+(totalLimit>0?' / '+money(totalLimit):'（未设总限额）'));
  if(totalLimit>0&&totalUsed!==undefined)rows.push('总额度剩余 '+money(Math.max(0,totalLimit-totalUsed)));
  const requests=numeric(u.requests),tokens=numeric(u.allTokens);
  if(requests!==undefined||tokens!==undefined)rows.push([requests!==undefined?'请求 '+requests.toLocaleString('zh-CN'):null,tokens!==undefined?'Token '+tokens.toLocaleString('zh-CN'):null].filter(Boolean).join(' · '));
  if(data.isActive===false)rows.push('密钥已停用');
  if(typeof data.expiresAt==='string'&&Number.isFinite(Date.parse(data.expiresAt)))rows.push('到期 '+new Date(data.expiresAt).toLocaleString('zh-CN'));
  if(!rows.length)throw new Error('CRS 未返回可用的统计数字');
  return {ok:true,kind:'proxy',provider:name,format:'monitor',rows,dailyUsed,dailyLimit,totalUsed,totalLimit,requests,tokens,...(percent!==undefined?{percent}:{}),queriedAt:Date.now()};
}
module.exports={normalizeStats};
