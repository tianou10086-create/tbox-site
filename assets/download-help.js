(() => {
  'use strict';
  const text = document.getElementById('verify-prompt');
  const c = window.TBOX_CONFIG;
  if (text && c) {
    text.value = text.value.replace(/^版本：.*$/m, '版本：' + c.VERSION)
      .replace(/^文件名：.*$/m, '文件名：' + c.PRIMARY_DOWNLOAD.split('/').pop())
      .replace(/^官网公布的 SHA256：.*$/m, '官网公布的 SHA256：' + c.SHA256);
  }
  function bind(fieldId, buttonId, statusId, success) {
    const field = document.getElementById(fieldId);
    const button = document.getElementById(buttonId);
    const status = document.getElementById(statusId);
    if (!field || !button || !status) return;
    button.disabled = false;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        status.textContent = success;
      } catch (error) {
        field.focus(); field.select();
        status.textContent = '自动复制未成功，内容已选中，请按 Ctrl+C 或长按复制。';
      }
    });
  }
  bind('verify-prompt','copy-verify-prompt','verify-copy-status','检查说明已复制。请按实际文件和实际输出逐步核对。');
  bind('verify-command','copy-verify-command','verify-command-status','校验命令已复制。请在 PowerShell 中粘贴执行，再按提示输入实际文件路径。');
})();
