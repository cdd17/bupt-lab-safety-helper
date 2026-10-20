const fs = require('node:fs');
const path = require('node:path');
const header = `// ==UserScript==
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
`;
fs.writeFileSync(path.join(__dirname, 'bupt-lab-safety-helper.user.js'), header +
  ['matcher.js', 'loader.js', 'controller.js'].map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n'));
console.log('Generated bupt-lab-safety-helper.user.js');
