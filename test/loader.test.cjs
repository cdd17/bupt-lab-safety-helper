const test = require('node:test');
const assert = require('node:assert/strict');
const {loadBank,files} = require('../src/loader.js');
const {validateBank} = require('../src/matcher.js');
const q = {qtext:'人工编写测试题',qurl:'',opts:{A:'对',B:'错'},ans:['A']};
test('下载全部公开文件并去除重复题目',async()=>{
  const urls=[]; const progress=[];
  const bank=await loadBank(async url=>{urls.push(url);return [q];},validateBank,
    (done,total)=>progress.push([done,total]),()=>false);
  assert.equal(urls.length,files.length);
  assert.ok(urls.every(url=>url.startsWith('https://raw.githubusercontent.com/KY-zhang-X/bupt-lab-safety/main/data/')));
  assert.equal(bank.length,1);
  assert.deepEqual(progress.at(-1),[files.length,files.length]);
});
test('下载失败不返回部分题库',async()=>{
  let calls=0;
  await assert.rejects(loadBank(async()=>{if(++calls===2)throw new Error('断网');return [q];},
    validateBank,()=>{},()=>false),/断网/);
  assert.equal(calls,2);
});
test('取消后不处理响应或下载下一文件',async()=>{
  let stopped=false,calls=0,validations=0;
  await assert.rejects(loadBank(async()=>{calls++;stopped=true;return [q];},
    input=>{validations++;return validateBank(input);},()=>{},()=>stopped),/取消/);
  assert.equal(calls,1);assert.equal(validations,0);
});
test('上游格式变化直接报错',async()=>{
  await assert.rejects(loadBank(async()=>({error:'not a bank'}),validateBank,()=>{},()=>false),/JSON 数组/);
});
