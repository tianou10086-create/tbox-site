(() => {
  'use strict';

  const SHEETS = {
    interview: {
      code: 'TBOX / 01',
      topic: '面试实时提词 · 系统回环拾音',
      titleHtml: 'Redis 缓存雪崩撞上来，<span>先盯哪三步？</span>',
      line1: '对方刚问完，本地回环采集已贴着你的简历起草第一人称回答要点。',
      line2: '浮窗挂在摄像头下方且不抢鼠标键盘焦点（WS_EX_NOACTIVATE）。',
      checkLabel: '展开查看真实提词参考',
      checkText: '① 先用互斥锁或双检挡住击穿重建；② 核心热 Key 用逻辑过期异步刷新，不卡主线程；③ 前置本地缓存与限流兜底，按你简历里实际用过的组件口径输出。'
    },
    exam: {
      code: 'TBOX / 02',
      topic: '笔试静默识题 · 原位不切页面',
      titleHtml: '不离开当前答题页，<span>怎么直接出思路？</span>',
      line1: '不点切屏、也不用鼠标框选复制，保持浏览器的当前焦距和状态。',
      line2: '自动识别屏幕题干与选项，先给出核心条件、复杂度和容易漏的边界。',
      checkLabel: '展开查看防误判边界',
      checkText: '桌面端通过不抢焦点窗口与画面读取降低切屏动作，但是否允许辅助以及各考试平台的网页脚本策略不同，请结合实际场景规则使用。'
    },
    shield: {
      code: 'TBOX / 03',
      topic: '共享排除 + v0.2.2 防斜拍护盾',
      titleHtml: '屏幕共享或侧后方有人时，<span>画面怎么保住？</span>',
      line1: '系统级 WDA_EXCLUDEFROMCAPTURE 让主流屏幕共享与常规截图里只见干净桌面。',
      line2: 'v0.2.2 新增双向十字栅、卷帘扫描条与安全暗字（Ctrl+Alt+S 切换）；Ctrl+Shift+H 或手机扫码 0.1 秒全部隐藏。',
      checkLabel: '展开查看物理边界与快捷键',
      checkText: '快捷操控：Ctrl+Alt+S 轮换防拍档位，Ctrl+Alt+A 切安全暗字，Ctrl+Shift+H 紧急隐藏。光学干扰可明显压低手机斜拍提取度，强逆光近拍仍受物理光学条件影响。'
    }
  };

  function initSheetSwitcher() {
    const sheet = document.querySelector('[data-ed-sheet]');
    if (!sheet) return;

    const tabs = [...sheet.querySelectorAll('[data-sheet-tab]')];
    const codeEl = sheet.querySelector('[data-sheet-code]');
    const topicEl = sheet.querySelector('[data-sheet-topic]');
    const titleEl = sheet.querySelector('[data-sheet-title]');
    const l1El = sheet.querySelector('[data-sheet-l1]');
    const l2El = sheet.querySelector('[data-sheet-l2]');
    const checkSummaryEl = sheet.querySelector('[data-sheet-check-label]');
    const checkTextEl = sheet.querySelector('[data-sheet-check-text]');
    const detailsEl = sheet.querySelector('.ed-check');

    function apply(key) {
      const data = SHEETS[key];
      if (!data) return;
      tabs.forEach(t => {
        t.setAttribute('aria-selected', t.dataset.sheetTab === key ? 'true' : 'false');
      });
      codeEl.textContent = data.code;
      topicEl.textContent = data.topic;
      titleEl.innerHTML = data.titleHtml;
      l1El.innerHTML = '<b>01</b> ' + data.line1;
      l2El.innerHTML = '<b>02</b> ' + data.line2;
      checkSummaryEl.textContent = data.checkLabel;
      checkTextEl.textContent = data.checkText;
      if (detailsEl) detailsEl.open = false;
    }

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => apply(tab.dataset.sheetTab));
      tab.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = (idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          tabs[next].focus();
          apply(tabs[next].dataset.sheetTab);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSheetSwitcher, { once: true });
  } else {
    initSheetSwitcher();
  }
})();
