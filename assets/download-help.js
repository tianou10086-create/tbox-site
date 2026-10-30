(() => {
  const text = document.getElementById('verify-prompt');
  const button = document.getElementById('copy-verify-prompt');
  const status = document.getElementById('verify-copy-status');
  const c = window.TBOX_CONFIG;
  if (c) {
    text.value = text.value.replace(/^版本：.*$/m, '版本：' + c.VERSION)
      .replace(/^文件名：.*$/m, '文件名：' + c.PRIMARY_DOWNLOAD.split('/').pop())
      .replace(/^官网公布的 SHA256：.*$/m, '官网公布的 SHA256：' + c.SHA256);
  }
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = '已复制，粘贴到豆包或其他 AI 即可。';
    } catch (error) {
      text.focus(); text.select();
      status.textContent = '自动复制未成功，内容已选中，请按 Ctrl+C 或长按复制。';
    }
  });
})();
