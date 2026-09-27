const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {normalizeCodexUsage}=require('../quota.cjs');
const context={AbortSignal,setTimeout};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/shared-core.js'),'utf8'),context);
const S=context.PetShared;
test('Codex quota preserves both windows, authoritative reset count and successful fetch time',async()=>{
  const now=Date.now(),bucket={primary:{usedPercent:23,windowDurationMins:300,resetsAt:2000000000},secondary:{usedPercent:48,windowDurationMins:10080,resetsAt:2000600000}};
  const state=normalizeCodexUsage({rateLimitsByLimitId:{other:{primary:{usedPercent:99}},codex:bucket},rateLimitResetCredits:{availableCount:3,credits:[]}},now);
  assert.equal(state.queriedAt,now);assert.equal(state.availableResetCount,3);assert.equal(state.windows.length,2);
  context.fetch=async()=>({ok:true,json:async()=>state});const parsed=await S.fetchBalanceState('http://fixture/balance');
  assert.equal(parsed.queriedAt,now);assert.equal(parsed.availableResetCount,3);
  const text=S.balanceBubbleView(parsed).map(row=>row.text).join('\n');
  assert.match(text,/5 小时：剩余 77%（已用 23%）/);assert.match(text,/1 周：剩余 52%（已用 48%）/);assert.match(text,/可用重置次数：3 次/);assert.equal((text.match(/重置时间：/g)||[]).length,2);assert.match(text,/更新时间：\d/);
  assert.equal(S.balancePercent(parsed),48);
});
test('missing quota fields remain unavailable and zero available resets is preserved',()=>{
  const state=normalizeCodexUsage({rateLimits:{primary:{usedPercent:12,windowDurationMins:300,resetsAt:null}},rateLimitResetCredits:null});
  const text=S.balanceBubbleView(state).map(row=>row.text).join('\n');
  assert.match(text,/1 周用量：未提供/);assert.match(text,/重置时间：未提供/);assert.match(text,/可用重置次数：未提供/);
  const zero=normalizeCodexUsage({rateLimits:{primary:{usedPercent:0,windowDurationMins:10080}},rateLimitResetCredits:{availableCount:0}});
  assert.match(S.balanceBubbleView(zero).map(row=>row.text).join('\n'),/可用重置次数：0 次/);
  assert.equal(normalizeCodexUsage({rateLimits:{primary:{usedPercent:0,resetsAt:1e100}}}).windows[0].resetsAt,undefined);
});
