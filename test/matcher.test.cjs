const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/matcher.js');
const q = {qtext:'题干： 不使用绝缘损坏或接地不良的电器设备。',qurl:'\\upload\\theme_picture\\old.jpeg',
  opts:{A:'对',B:'错'},ans:['A']};
const page = {stem:'',image:'/upload/theme_picture/new.jpeg',options:[{value:'A',text:'对'},{value:'B',text:'错'}],multiple:false};
test('保留正负号、小数点和比较运算符',()=>{
  assert.notEqual(M.normalize('-30'),M.normalize('30'));
  assert.notEqual(M.normalize('1.5'),M.normalize('15'));
  assert.notEqual(M.normalize('x>3'),M.normalize('x<3'));
});
test('题库验证与重复答案清理',()=>assert.deepEqual(M.validateBank([{...q,ans:['A','A']}])[0].ans,['A']));
test('拒绝无效题库和不存在的答案',()=>{
  for(const bad of [[],{},[{...q,ans:['C']}],[{...q,opts:[]}],[{...q,ans:[]}]]) assert.throws(()=>M.validateBank(bad));
});
test('无法只用真假选项匹配判断题',()=>assert.equal(M.matchQuestion([q],page).status,'unmatched'));
test('图片路径分隔符与查询参数标准化',()=>assert.equal(M.imageKey('\\upload\\OLD.JPEG?x=1'),'old.jpeg'));
test('图片文件名匹配',()=>assert.deepEqual(M.matchQuestion([q],{...page,image:'/upload/old.jpeg'}).answers,['A']));
test('题干匹配并映射打乱选项',()=>assert.deepEqual(M.matchQuestion([q],{...page,stem:q.qtext,
  options:[{value:'A',text:'错'},{value:'B',text:'对'}]}).answers,['B']));
test('人工确认过的图片映射',()=>assert.equal(M.matchQuestion([q],page,{'new.jpeg':q.qtext}).status,'matched'));
test('相同题干答案冲突必须暂停',()=>assert.equal(M.matchQuestion([q,{...q,ans:['B']}],{...page,stem:q.qtext}).status,'ambiguous'));
test('完整选项匹配及多选映射',()=>{
  const multi={qtext:'题干：多选示例',qurl:'',opts:{A:'切断电源',B:'佩戴护目镜',C:'清理工具'},ans:['A','C']};
  const p={stem:'',image:'',multiple:true,options:[{value:'X',text:'清理工具'},{value:'Y',text:'切断电源'},{value:'Z',text:'佩戴护目镜'}]};
  assert.deepEqual(M.matchQuestion([multi],p).answers,['X','Y']);
  assert.equal(M.matchQuestion([multi],{...p,multiple:false}).status,'unmatched');
});
test('相同选项不同答案禁止填写',()=>{
  const first={qtext:'甲题',qurl:'',opts:{A:'苹果',B:'香蕉',C:'西瓜'},ans:['A']};
  const p={stem:'',image:'',options:Object.entries(first.opts).map(([value,text])=>({value,text}))};
  assert.equal(M.matchQuestion([first,{...first,qtext:'乙题',ans:['B']}],p).status,'ambiguous');
});
test('重复选项不允许答案映射',()=>assert.equal(M.mapAnswers({...q,opts:{A:'对',B:'对'}},
  [{value:'A',text:'对'},{value:'B',text:'对'}]),null));
test('OCR 小误差需要人工确认',()=>{
  const longer={...q,qtext:'题干：进入实验室前应当仔细阅读安全手册，不使用绝缘损坏或接地不良的电器设备。'};
  const stem=longer.qtext.replace('不良','不凉');
  assert.equal(M.matchQuestion([longer],{...page,stem}).reviewRequired,true);
});
test('不一致题干不能被通用选项覆盖',()=>{
  const first={qtext:'应当佩戴个人防护用品',qurl:'',opts:{A:'是',B:'否',C:'不清楚'},ans:['A']};
  const p={stem:'能够在实验室饮食吸烟',image:'',options:Object.entries(first.opts).map(([value,text])=>({value,text}))};
  assert.equal(M.matchQuestion([first],p).status,'unmatched');
});
test('题干优先于旧图片映射',()=>{
  const opposite={...q,qtext:'题干：可以在粉尘操作区饮食及吸烟。',ans:['B']};
  assert.deepEqual(M.matchQuestion([q,opposite],{...page,stem:opposite.qtext},{'new.jpeg':q.qtext}).answers,['B']);
});
