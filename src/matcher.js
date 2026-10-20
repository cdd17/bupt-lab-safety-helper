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
