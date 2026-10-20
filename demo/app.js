(async function(){
  const params=new URLSearchParams(location.search); const mode=params.get('mode')||'ajax';
  let n=Number(params.get('n')||1);
  const bank=await (await fetch('/bank')).json();
  // 模拟 GM 本机存储接口；控制器和匹配引擎直接使用 src 原代码。
  window.GM_getValue=(key,fallback)=>JSON.parse(localStorage.getItem(key)||'null')||fallback;
  window.GM_setValue=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  window.GM_xmlhttpRequest=opts=>{
    setTimeout(()=>opts.onload({status:200,responseText:JSON.stringify(bank)}),80);
  };
  const specs=[
    {q:bank[0],order:['C','A','B'],image:'known-1.png'},
    {q:bank[1],order:['C','B','A'],image:'new-2.png',multi:true},
    {q:bank[2],order:['B','A'],image:'new-3.png'},
    {q:bank[3],order:['A','B','C'],image:'known-4.png'},
    {q:bank[5],order:['A','B'],image:'known-5.png'}
  ];
  for(const spec of specs){
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=72;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,72);ctx.fillStyle='black';ctx.font='28px "Microsoft YaHei",sans-serif';
    ctx.fillText(spec.q.qtext.replace(/^题干：/,''),15,45);
    spec.src=canvas.toDataURL('image/png')+'#theme_picture/'+spec.image;
    if(spec.image.startsWith('known'))spec.q.qurl=spec.src;
  }
  bank[4].qurl=specs[3].src;
  const answers=()=>JSON.parse(localStorage.getItem('demo-answers')||'{}');
  function save(){const values=[...document.querySelectorAll('input:checked')].map(e=>e.value);const all=answers();all[n]=values;localStorage.setItem('demo-answers',JSON.stringify(all));}
  function paint(){
    const spec=specs[n-1];document.getElementById('mode').textContent=`第 ${n} / 5 题 · ${mode==='reload'?'iframe 整页导航':'同页面异步切题'}`;
    const table=document.getElementById('exam');table.replaceChildren();
    const row=table.insertRow();row.insertCell().textContent=n+'.';
    const img=document.createElement('img');img.src=spec.src;
    row.insertCell().append(img);row.insertCell().textContent='（分数：2分）';
    const saved=answers()[n];
    spec.order.forEach((original,i)=>{
      const value=String.fromCharCode(65+i);const cell=table.insertRow().insertCell();
      const input=document.createElement('input');input.type=spec.multi?'checkbox':'radio';input.name='answers';input.value=value;
      input.checked=saved?saved.includes(value):(spec.multi&&i===0);
      const label=document.createElement('label');label.append(input,`${value}、 ${spec.q.opts[original]}`);cell.append(label);
    });
    const actions=table.insertRow().insertCell();
    if(n<5){const next=document.createElement('button');next.textContent='下一题';next.onclick=()=>formsubmit(String(n+1));actions.append(next);}
    const submit=document.createElement('button');submit.textContent='提交试卷';submit.onclick=()=>{
      save();const expected=[['B'],['B','C'],['B'],['A'],['A']];const actual=answers();
      const score=expected.reduce((s,a,i)=>s+Number(JSON.stringify(actual[i+1])===JSON.stringify(a))*20,0);
      document.getElementById('result').textContent=`模拟交卷：${score} 分（第4题为故意设置的题库冲突）。`;
    };actions.append(submit);
    const nav=table.insertRow().insertCell();for(let i=1;i<=5;i++){const a=document.createElement('a');a.href=`javascript:formsubmit('${i}')`;a.textContent=i;nav.append(a);}
    document.getElementById('record').textContent='已保存答案：'+JSON.stringify(answers());
  }
  window.formsubmit=value=>{
    document.getElementById('result').textContent=`导航请求 ${n} → ${value}，readyState=${document.readyState}`;
    save();if(mode==='reload'){location.href='/exam?mode=reload&n='+value;return;}
    n=Number(value);paint();
  };
  paint();
  const ocr=document.createElement('script');ocr.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  ocr.onload=()=>{const controller=document.createElement('script');controller.src='/src/controller.js';document.body.append(controller);};
  ocr.onerror=()=>{document.getElementById('result').textContent='公网 OCR 库加载失败；可继续手动题干测试。';const controller=document.createElement('script');controller.src='/src/controller.js';document.body.append(controller);};
  document.body.append(ocr);
})();
