// ==UserScript==
// @name         BUPT Lab Safety Helper
// @namespace    bupt-lab-safety-helper
// @version      0.2.0
// @description  导入本地题库，识别并填写实验室安全考试页面
// @match        http://10.3.244.16/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/cdd17/bupt-lab-safety-helper/main/bupt-lab-safety-helper.user.js
// @updateURL    https://raw.githubusercontent.com/cdd17/bupt-lab-safety-helper/main/bupt-lab-safety-helper.user.js
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js
// @license      MIT
// ==/UserScript==
(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/^\s*题干\s*[:：]\s*/, '').toLowerCase()
    .replace(/[\s，。、；;：:“”"'‘’!?！？（）()\[\]【】]/g, '');
  const imageKey = value => String(value || '').replace(/\\/g, '/')
    .split(/[?#]/)[0].split('/').pop().toLowerCase();
  const optionText = value => normalize(String(value || '').replace(/^\s*[A-Z]\s*[、.．:：)）]\s*/i, ''));
  function validateBank(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('题库必须是非空 JSON 数组');
    return input.map((q, i) => {
      if (!q || typeof q.qtext !== 'string' || !q.opts || typeof q.opts !== 'object'
          || Array.isArray(q.opts) || !Array.isArray(q.ans) || !q.ans.length)
        throw new Error(`第 ${i + 1} 条题目格式不正确`);
      const opts = Object.fromEntries(Object.entries(q.opts).map(([k, v]) => [k.toUpperCase(), String(v)]));
      const ans = [...new Set(q.ans.map(a => String(a).toUpperCase()))];
      if (ans.some(a => !Object.hasOwn(opts, a))) throw new Error(`第 ${i + 1} 条答案不在选项中`);
      return { qtext: q.qtext, qurl: String(q.qurl || ''), opts, ans };
    });
  }
  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a.length || !b.length) return 0;
    let prev = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j-1] + 1,
        prev[j] + 1, prev[j-1] + Number(a[i-1] !== b[j-1]));
      prev = row;
    }
    return 1 - prev[b.length] / Math.max(a.length, b.length);
  }
  // 根据选项内容映射答案，不能假定系统与题库使用相同选项顺序。
  function mapAnswers(q, current) {
    const bankValues = Object.values(q.opts).map(optionText).sort();
    const pageValues = current.map(o => optionText(o.text)).sort();
    if (JSON.stringify(bankValues) !== JSON.stringify(pageValues)) return null;
    const result = [];
    for (const a of q.ans) {
      const matches = current.filter(o => optionText(o.text) === optionText(q.opts[a]));
      if (matches.length !== 1) return null;
      result.push(matches[0].value);
    }
    return result.sort();
  }
  function matchQuestion(bank, page, aliases = {}) {
    const eligible = bank.map(q => ({ q, answers: mapAnswers(q, page.options) }))
      .filter(x => x.answers && (page.multiple || x.answers.length === 1));
    const resolve = (items, method, confidence) => {
      if (!items.length) return null;
      const outcomes = new Set(items.map(x => JSON.stringify(x.answers)));
      if (outcomes.size !== 1) return { status: 'ambiguous', reason: '候选题目答案不一致', candidates: items.length };
      return { status: 'matched', method, confidence, answers: items[0].answers,
        question: items[0].q.qtext, candidates: items.length };
    };
    const stem = normalize(page.stem);
    if (stem) {
      const exact = resolve(eligible.filter(x => normalize(x.q.qtext) === stem), '题干完全匹配', 1);
      if (exact) return exact;
    }
    const key = imageKey(page.image);
    const alias = key && aliases[key];
    if (alias) {
      const cached = resolve(eligible.filter(x => normalize(x.q.qtext) === normalize(alias)), '本机确认过的图片映射', 1);
      if (cached) return cached;
    }
    if (key) {
      const image = resolve(eligible.filter(x => imageKey(x.q.qurl) === key), '图片文件名匹配', 1);
      if (image) return image;
    }
    if (stem.length >= 10) {
      const ranked = eligible.map(x => ({ ...x, score: similarity(stem, x.q.qtext) })).sort((a,b) => b.score-a.score);
      const best = ranked[0];
      if (best && best.score >= 0.96) {
        const near = ranked.filter(x => x.score >= best.score - 0.04);
        const result = resolve(near, 'OCR 近似题干匹配（需确认）', best.score);
        if (result) return { ...result, reviewRequired: true };
      }
    }
    const texts = page.options.map(o => optionText(o.text));
    if (texts.length >= 3 && new Set(texts).size === texts.length) {
      // 有了题干却不一致时，不能只凭通用选项越过题干冲突。
      const candidates = stem ? eligible.filter(x => similarity(stem, x.q.qtext) >= 0.9) : eligible;
      const result = resolve(candidates, '完整选项集合匹配', 1);
      if (result) return result;
    }
    return { status: 'unmatched', reason: '没有可靠匹配，请核对题干或补充题库' };
  }
  const api = { normalize, imageKey, optionText, validateBank, similarity, mapAnswers, matchQuestion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuptSafetyMatcher = api;
})(typeof window === 'undefined' ? {} : window);

(function (root) {
  'use strict';
  const files = ['-1_450536.json', '-1_450564.json', '-1_450568.json', '446345_0.json',
    '446606_0.json', '446622_0.json', '446628_0.json', '446631_0.json', '446634_0.json',
    '446648_0.json', '446652_0.json', '446659_0.json', '446661_0.json', '446683_0.json'];
  const base = 'https://raw.githubusercontent.com/KY-zhang-X/bupt-lab-safety/main/data/';
  async function loadBank(request, validate, progress, cancelled) {
    const unique = new Map();
    for (let i = 0; i < files.length; i++) {
      if (cancelled()) throw new Error('已取消题库下载');
      progress(i, files.length);
      const input = await request(base + files[i]);
      if (cancelled()) throw new Error('已取消题库下载');
      const questions = validate(input);
      for (const q of questions) unique.set(JSON.stringify(q), q);
    }
    progress(files.length, files.length);
    return [...unique.values()];
  }
  const api = { files, loadBank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuptSafetyLoader = api;
})(typeof window === 'undefined' ? {} : window);

(async function () {
  'use strict';
  const M = window.BuptSafetyMatcher;
  // 只在存在答题控件与题目导航的文档中启动，包括网站的考试 iframe。
  const nextButton = () => [...document.querySelectorAll('input[type="button"],input[type="submit"],button')]
    .find(e => (e.value || e.textContent).trim() === '下一题');
  const answerInputs = () => [...document.querySelectorAll('input[type="radio"],input[type="checkbox"]')]
    .filter(e => /^[A-Z]$/.test(e.value) && !e.disabled);
  const questionLinks = () => [...document.querySelectorAll('a')].filter(e => /^\d+$/.test(e.textContent.trim())
    && /^javascript:formsubmit\(/.test(e.getAttribute('href') || ''));
  if (!answerInputs().length || !questionLinks().length) return;
  const STORE = 'bupt-helper-v1';
  const readStore = () => GM_getValue(STORE, { bank: [], aliases: {}, running: false, last: '', log: [] });
  const update = patch => GM_setValue(STORE, { ...readStore(), ...patch });
  let bank;
  try { bank = readStore().bank.length ? M.validateBank(readStore().bank) : []; }
  catch { bank = []; update({ running: false }); }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
  document.body.append(host);
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>
    *{box-sizing:border-box}section{width:360px;background:#fff;color:#17202a;border:1px solid #bbc9d8;
    border-radius:12px;padding:16px;box-shadow:0 6px 28px #0003;font:14px/1.5 system-ui}
    h3{margin:0 0 8px}button{cursor:pointer;padding:7px 10px;margin:4px 3px 0 0;border:1px solid #bccbd9;
    border-radius:6px;background:#f5f8fb;color:#17202a}button:disabled{opacity:.45;cursor:default}
    textarea{width:100%;height:58px;margin-top:8px}pre{white-space:pre-wrap;max-height:190px;overflow:auto;
    background:#f3f6fa;padding:8px;font:12px/1.5 system-ui}small{display:block;color:#526475}
    summary{cursor:pointer}input[type=file]{max-width:100%}
    </style><section><h3>实验室安全答题助手</h3>
    <small id="count"></small>
    <div><button id="start">一键开始</button><button id="stop">停止</button></div>
    <small>首次自动下载公开题库；匹配不确定时暂停，完成后请检查并交卷。</small>
    <details><summary>手动操作与题库</summary>
    <button id="download">下载 / 更新题库</button>
    <input id="import" type="file" accept=".json,application/json" multiple>
    <div><button id="match">识别当前题</button><button id="fill" disabled>填写当前题</button>
    </div></details>
    <textarea id="stem" placeholder="OCR 不准时，在这里输入完整题干后重新识别"></textarea>
    <pre id="status">点“一键开始”即可下载题库并填写。首次需要公网；下载失败可展开“手动操作与题库”导入 JSON。</pre>
    <details><summary>本机数据</summary><button id="export">导出操作记录</button>
    <button id="clear">清除题库、映射和记录</button></details></section>`;
  const $ = id => shadow.getElementById(id);
  const say = text => { $('status').textContent = text; };
  const count = () => { $('count').textContent = `本机题库：${bank.length} 条；识别在本机完成`; };
  count();
  let busy = false, active = null, worker = null, stopped = false;
  function requestBank(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method:'GET', url, anonymous:true, timeout:30000,
      onload: response => {
        if (response.status !== 200) { reject(new Error(`题库下载失败：HTTP ${response.status}`)); return; }
        try { resolve(JSON.parse(response.responseText)); }
        catch { reject(new Error('题库源返回的不是有效 JSON')); }
      },
      onerror: () => reject(new Error('无法下载 GitHub 题库，请检查公网连接或手动导入')),
      ontimeout: () => reject(new Error('题库下载超时，可重试或手动导入'))
    }));
  }
  async function downloadBank() {
    update({running:false});
    const downloaded = await window.BuptSafetyLoader.loadBank(requestBank, M.validateBank,
      (done,total) => say(`正在下载公开题库：${done} / ${total}。可点击“停止”取消。`), () => stopped);
    if (stopped) return;
    bank = downloaded; active = null; $('fill').disabled = true;
    // 全部文件成功后才替换缓存，下载失败保留之前的题库。
    update({bank,aliases:{},last:''}); count(); say(`题库已就绪：${bank.length} 条。`);
  }
  function readPage() {
    const inputs = answerInputs();
    const table = inputs[0]?.closest('table');
    if (!table) throw new Error('找不到题目表格');
    const img = [...table.querySelectorAll('img')].find(e => /theme_picture/i.test(e.getAttribute('src') || ''));
    const options = inputs.map(e => ({value:e.value, text:(e.closest('tr')?.innerText || e.parentElement.textContent).trim()}));
    const row = img?.closest('tr');
    const textStem = row ? row.innerText.replace(/^\s*\d+\s*[.．]/, '')
      .replace(/[（(]\s*分数[：:].*?[）)]/g, '').trim() : '';
    const page = { image:img?.getAttribute('src') || '', stem:textStem, options,
      multiple:inputs.every(e => e.type === 'checkbox') };
    return {page,inputs,img,fingerprint:JSON.stringify([page.image,page.stem,page.options])};
  }
  async function recognize() {
    active = null; $('fill').disabled = true;
    if (!bank.length) throw new Error('请先导入题库 JSON 文件');
    const current = readPage();
    current.page.stem = $('stem').value.trim() || current.page.stem;
    let result = M.matchQuestion(bank, current.page, readStore().aliases);
    if (result.status !== 'matched' && current.img && !current.page.stem) {
      say('下载 OCR 语言模型并识别题干图片，首次使用可能需要较长时间…');
      if (!worker) worker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: msg => { if (msg.status === 'recognizing text') say(`本机 OCR：${Math.round(msg.progress * 100)}%`); }
      });
      if (stopped) return null;
      const response = await worker.recognize(current.img.src.split('#')[0]);
      current.page.stem = response.data.text.trim();
      $('stem').value = current.page.stem;
      result = M.matchQuestion(bank, current.page, readStore().aliases);
    }
    if (stopped) return null;
    if (readPage().fingerprint !== current.fingerprint) throw new Error('题目已切换，请重新识别');
    active = { ...current, result };
    $('fill').disabled = result.status !== 'matched';
    say(result.status === 'matched' ? `${result.method}\n题库题干：${result.question}\n选择：${result.answers.join('、')}`
      + (result.reviewRequired ? '\n请核对 OCR 与题库题干，点击“填写当前题”确认。' : '')
      : `${result.reason}${current.page.stem ? '\n识别题干：' + current.page.stem : ''}`);
    return active;
  }
  function fillCurrent(manual) {
    if (!active || active.result.status !== 'matched') throw new Error('请先识别当前题');
    if (readPage().fingerprint !== active.fingerprint) throw new Error('页面已切换，已取消填写');
    if (active.result.reviewRequired && !manual) throw new Error('近似 OCR 匹配需要人工确认');
    const {answers, question, method} = active.result;
    for (const input of active.inputs) {
      const selected = answers.includes(input.value);
      if (input.checked !== selected) input.click();
    }
    if (active.inputs.some(e => e.checked !== answers.includes(e.value))) throw new Error('填写后选中状态不一致');
    const state = readStore();
    // 只记录题干、答案与匹配方式；不读取用户名、登录 Cookie 或密码。
    const log = [...state.log, { time:new Date().toISOString(), question, answers, method }].slice(-500);
    const aliases = { ...state.aliases };
    if (manual && active.page.image) aliases[M.imageKey(active.page.image)] = question;
    update({aliases,log});
    say(`已填写：${answers.join('、')}\n${question}`);
  }
  async function step() {
    const selected = await recognize();
    if (stopped || !readStore().running) return;
    if (!selected || selected.result.status !== 'matched' || selected.result.reviewRequired) {
      update({running:false}); return;
    }
    fillCurrent(false);
    const next = nextButton();
    if (!next || next.disabled) { update({running:false}); say('已填写最后一题，请检查答案并自行提交试卷。'); return; }
    update({last:selected.fingerprint});
    $('stem').value = '';
    next.click();
    // 同文档异步切题；完整 iframe 导航由新脚本实例通过 running 状态继续。
    for (let i=0; i<40; i++) {
      await new Promise(resolve => setTimeout(resolve,250));
      if (stopped || !readStore().running) return;
      if (readPage().fingerprint !== selected.fingerprint) { await step(); return; }
    }
    update({running:false}); say('下一题未成功加载，已暂停。请检查网络与页面。');
  }
  async function guard(action) {
    if (busy) return;
    busy = true; stopped = false;
    try { await action(); }
    catch (error) { update({running:false}); say(`已暂停：${error.message}`); }
    finally { busy=false; }
  }
  $('import').onchange = () => guard(async () => {
    update({running:false});
    const merged = [];
    for (const file of $('import').files) merged.push(...M.validateBank(JSON.parse(await file.text())));
    if (!merged.length) return;
    bank = merged; active = null; $('fill').disabled = true;
    update({bank,aliases:{},last:''}); count(); say(`已导入 ${bank.length} 条题目。`);
  });
  $('match').onclick = () => guard(recognize);
  $('fill').onclick = () => guard(() => fillCurrent(true));
  $('download').onclick = () => guard(downloadBank);
  $('start').onclick = () => guard(async () => {
    if (!bank.length) await downloadBank();
    if (stopped) return;
    update({running:true,last:''}); await step();
  });
  $('stop').onclick = () => { stopped=true; update({running:false}); say('已停止。'); };
  $('clear').onclick = () => {
    stopped=true; bank=[]; active=null; $('fill').disabled=true;
    update({bank:[],aliases:{},running:false,last:'',log:[]}); count(); say('本机数据已清除。');
  };
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(readStore().log,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='bupt-helper-log.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.addEventListener('pagehide', () => { stopped=true; worker?.terminate(); });
  const saved = readStore();
  if (saved.running) {
    if (readPage().fingerprint === saved.last) { update({running:false}); say('页面仍是上一题，已暂停以避免重复操作。'); }
    else await guard(step);
  }
})();
