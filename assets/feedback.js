(() => {
  'use strict';
  const form=document.getElementById('feedback-form');if(!form)return;
  const result=document.getElementById('feedback-output');const section=document.getElementById('feedback-output-section');const status=document.getElementById('feedback-status');
  const ids=['kind','version','os','description','steps','result'];
  document.getElementById('feedback-generate').disabled=false;
  form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(ids.map(id=>[id,document.getElementById('feedback-'+id).value]));if(!data.description.trim()){status.textContent='请先写下具体问题，不能只有空格。';document.getElementById('feedback-description').focus();return;}result.value=window.TBOX_PLATFORM.feedback(data);section.hidden=false;status.textContent='说明已在本页生成，尚未发送。请检查并移除敏感信息，再自行发送。';result.focus();});
  form.addEventListener('reset',()=>{result.value='';section.hidden=true;status.textContent='本页内容已清空，未发送任何反馈。';});
  document.getElementById('feedback-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.value);status.textContent='说明已复制，尚未发送。请到 QQ 售后群自行粘贴。';}catch{result.focus();result.select();status.textContent='自动复制未成功，文字已选中，请按 Ctrl+C 或长按复制。尚未发送。';}});
  document.getElementById('feedback-download').addEventListener('click',()=>{const blob=new Blob([result.value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='TBox-问题反馈-待本人发送.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已请求浏览器保存文本，是否保存成功请查看下载列表。尚未发送反馈。';});
})();
