// Run: node demo/server.cjs, then open http://127.0.0.1:8876/
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const questions = [
  {qtext:'题干：设备冒烟时应首先做什么？',qurl:'/theme_picture/known-1.png',opts:{A:'切断电源',B:'继续运行',C:'靠近观察'},ans:['A']},
  {qtext:'题干：请选择两项操作。',qurl:'/theme_picture/old-2.png',opts:{A:'佩戴护目镜',B:'整理工具',C:'忽略异常'},ans:['A','B']},
  {qtext:'题干：实验结束后应关闭电源。',qurl:'/theme_picture/old-3.png',opts:{A:'对',B:'错'},ans:['A']},
  {qtext:'题干：答案冲突演示',qurl:'/theme_picture/known-4.png',opts:{A:'甲选项',B:'乙选项',C:'丙选项'},ans:['A']},
  {qtext:'题干：答案冲突演示',qurl:'/theme_picture/known-4.png',opts:{A:'甲选项',B:'乙选项',C:'丙选项'},ans:['B']},
  {qtext:'题干：实验结束后请整理工具。',qurl:'/theme_picture/known-5.png',opts:{A:'对',B:'错'},ans:['A']}
];
const server = http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const url = new URL(req.url,'http://127.0.0.1');
  const assets = {'/src/matcher.js':'src/matcher.js','/src/loader.js':'src/loader.js',
    '/src/controller.js':'src/controller.js','/demo/app.js':'demo/app.js'};
  if(assets[url.pathname]) {res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,assets[url.pathname])));return;}
  if(url.pathname==='/bank') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(questions));return;}
  if(url.pathname==='/exam') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;color:#19334d;padding:24px}table{width:65%;border:1px solid #bbc9d8;border-radius:8px}td{padding:12px}img{max-width:100%}a{margin-right:18px}button{padding:8px;cursor:pointer}</style>
      <h2>模拟答题页面</h2><p id="mode"></p><table id="exam"></table><p id="record"></p><p id="result"></p>
      <script src="/src/matcher.js"></script><script src="/src/loader.js"></script><script src="/demo/app.js"></script>`);return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><title>答题助手模拟试用</title>
    <style>body{font:16px/1.7 system-ui;background:#eef4fa;color:#17324d;margin:0;padding:28px}h1{margin:0}iframe{width:100%;height:620px;border:1px solid #cad5e1;background:white;margin-top:20px}a,button{margin-right:20px}button{padding:8px;cursor:pointer}</style>
    <h1>答题助手模拟试用</h1><p>人工编写的五道题 · 不连接校园系统 · 不上传考试信息</p>
    <a href="/?mode=ajax">试用异步切题</a><a href="/?mode=reload">试用 iframe 整页翻页</a>
    <button onclick="localStorage.clear();location.reload()">重置模拟数据</button>
    <p>点击助手“一键开始”：第1题单选乱序、第2题多选替换、第3题真实中文 OCR、第4题冲突暂停、第5题人工交卷。</p>
    <iframe id="iframe_updatediv" src="/exam?mode=${url.searchParams.get('mode')==='reload'?'reload':'ajax'}&n=1"></iframe>`);
});
server.listen(8876,'127.0.0.1',()=>console.log('Simulation: http://127.0.0.1:8876/'));
