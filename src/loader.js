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
