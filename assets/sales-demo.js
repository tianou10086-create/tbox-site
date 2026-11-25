(() => {
  'use strict';

  const SCENES = {
    interview: {
      modePill: '面试 · 系统回环拾音 · WS_EX_NOACTIVATE',
      bgLabel: '某线上视频面试房间（对方正在说话）',
      bgTitle: '面试官（系统音频）',
      bgText: '“看你简历写过 Redis 秒杀库存，那如果遇到热点 Key 刚好过期、瞬间几万并发打穿数据库，你在工程里实际怎么兜住的？”',
      overlayTag: 'TBOX 透明提词浮窗（已贴合你的简历）',
      overlayText: '直接答要点（第一人称）：① 我在当时项目里优先用「互斥锁 + 双检」挡住重建请求，没拿到的短暂自旋重试；② 对核心热 Key 直接改「逻辑过期 + 后台异步刷新」，读请求永远不阻塞；③ 兜底加布隆过滤器与本地 Caffeine 一级缓存，把 DB QPS 压在 300 以内。',
      caption: '基于电脑系统声音实时拾音并结合导入简历出词，不用切窗口打字。',
      hiddenInShare: false,
      allowToggleShare: false,
      allowToggleShield: false,
    },
    exam: {
      modePill: '笔试 · 同屏静默识别 · 防切屏误判',
      bgLabel: '在线编程 / 笔试答题页面（保持在当前页）',
      bgTitle: '第 14 题 · 算法分析',
      bgText: '给定一个非递减排序整数数组 nums 和目标值 target，请编写函数返回首个大于等于 target 的元素下标；若全部小于 target 则返回数组长度。要求时间复杂度优于 O(n)。',
      overlayTag: 'TBOX 笔试识题结果（未离开当前页面）',
      overlayText: '思路（闭区间/左闭右开二分 lower_bound）：维护左边界 l=0、右边界 r=len(nums)，条件 while l < r，若 nums[mid] >= target 则 r=mid 否则 l=mid+1，返回 l。注意空数组直接返回 0、重复值返回最左位置。复杂度时间 O(log n)，空间 O(1)。',
      caption: '不离开当前考题界面，题目稳定后自动识别题干与代码约束，直接出边界与写法。',
      hiddenInShare: false,
      allowToggleShare: false,
      allowToggleShield: false,
    },
    privacy: {
      modePill: '系统底层捕获排除 · WDA_EXCLUDEFROMCAPTURE',
      bgLabel: '腾讯会议 / 屏幕共享演示桌面',
      bgTitle: '当前屏幕画面状态',
      bgText: '左侧是面试题目或代码编辑器，右上角挂着 TBOX 透明提词条。你可以点击下方按钮，切换「面试官看到的共享画面视角」与「你自己眼睛直视屏幕视角」。',
      overlayTag: 'TBOX 提词浮窗（系统捕获排除已生效）',
      overlayText: '这段回答提纲、简历要点以及右键菜单都在 Windows 底层设置了捕获排除标识：系统桌面合成器渲染给你看，但标准屏幕共享、截图与常见录屏流拿到的是干净背景。',
      hiddenTag: '面试官 / 共享接收端看到的画面',
      hiddenText: '【共享流中该浮窗区域完全透明隐形】—— 对方画面只剩下一片干净的代码编辑器与桌面背景，看不到任何 TBOX 窗口和文字。',
      caption: '点右侧按钮，直观对比系统级「捕获排除」在屏幕共享中的实际表现。',
      hiddenInShare: true,
      allowToggleShare: true,
      allowToggleShield: false,
    },
    antiscan: {
      modePill: 'v0.2.2 · 光学防偷拍护盾 & 手机扫码全隐身',
      bgLabel: '工位 / 侧后方可能有手机摄像头环境',
      bgTitle: '护盾开启状态：双向十字栅 + 卷帘扫描带 + 低反差安全暗字',
      bgText: '打开光学护盾后，浮窗叠加与手机 CMOS 逐行快门错频的高频动态亚像素矩阵，同时自动柔化纯白高光，你正坐在屏幕前依然读得清楚；手机突然一拍或侧面拉焦则会出现条纹混叠。',
      overlayTag: 'TBOX 浮窗 · 光学防手机偷拍护盾运行中',
      overlayText: '人眼贴屏专注看字柔和清晰，右侧/斜后方手机拍照难提取干净白字高反差笔画；遇突发情况用微信扫二维码或按 Ctrl+Shift+H，电脑主窗+浮窗 0.1 秒全部彻底消失。',
      caption: '提示：光学防拍可大幅压低手机拍照与 OCR 提取清晰度（物理条件仍受光线焦距影响），突发情况可一键全局隐身。',
      hiddenInShare: false,
      allowToggleShare: false,
      allowToggleShield: true,
    }
  };

  function initSimulator() {
    const root = document.querySelector('[data-tbox-sim]');
    if (!root) return;

    const tabs = [...root.querySelectorAll('[data-sim-tab]')];
    const modePill = root.querySelector('[data-sim-mode]');
    const bgLabel = root.querySelector('[data-sim-bg-label]');
    const bgTitle = root.querySelector('[data-sim-bg-title]');
    const bgText = root.querySelector('[data-sim-bg-text]');
    const overlayBox = root.querySelector('[data-sim-overlay]');
    const overlayTag = root.querySelector('[data-sim-overlay-tag]');
    const overlayText = root.querySelector('[data-sim-overlay-text]');
    const caption = root.querySelector('[data-sim-caption]');
    const btnShare = root.querySelector('[data-sim-toggle-share]');
    const btnShield = root.querySelector('[data-sim-toggle-shield]');

    let activeKey = 'interview';
    let sharePreviewHidden = true;
    let shieldPreviewOn = true;

    function render() {
      const s = SCENES[activeKey];
      tabs.forEach(tab => {
        const selected = tab.dataset.simTab === activeKey;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      modePill.textContent = s.modePill;
      bgLabel.textContent = s.bgLabel;
      bgTitle.textContent = s.bgTitle;
      bgText.textContent = s.bgText;
      caption.textContent = s.caption;

      btnShare.hidden = !s.allowToggleShare;
      btnShield.hidden = !s.allowToggleShield;

      overlayBox.classList.remove('is-hidden-view', 'is-shielded');

      if (activeKey === 'privacy' && sharePreviewHidden) {
        overlayBox.classList.add('is-hidden-view');
        overlayTag.textContent = s.hiddenTag;
        overlayText.textContent = s.hiddenText;
        btnShare.setAttribute('aria-pressed', 'true');
        btnShare.textContent = '切换回：我自己电脑看到的视角';
      } else if (activeKey === 'privacy') {
        overlayTag.textContent = s.overlayTag;
        overlayText.textContent = s.overlayText;
        btnShare.setAttribute('aria-pressed', 'false');
        btnShare.textContent = '切换为：对方屏幕共享看到的视角';
      } else {
        overlayTag.textContent = s.overlayTag;
        overlayText.textContent = s.overlayText;
      }

      if (activeKey === 'antiscan') {
        btnShield.setAttribute('aria-pressed', shieldPreviewOn ? 'true' : 'false');
        if (shieldPreviewOn) {
          overlayBox.classList.add('is-shielded');
          btnShield.textContent = '护盾已开启（点此模拟关闭对比）';
        } else {
          btnShield.textContent = '护盾已关闭（点此开启防拍效果）';
        }
      }
    }

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        activeKey = tab.dataset.simTab;
        render();
      });
      tab.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = (idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          tabs[next].focus();
          activeKey = tabs[next].dataset.simTab;
          render();
        }
      });
    });

    btnShare?.addEventListener('click', () => {
      sharePreviewHidden = !sharePreviewHidden;
      render();
    });

    btnShield?.addEventListener('click', () => {
      shieldPreviewOn = !shieldPreviewOn;
      render();
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimulator, { once: true });
  } else {
    initSimulator();
  }
})();
