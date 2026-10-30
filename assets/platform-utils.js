(function(root){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  function matches(text,query){const words=normalize(query).split(' ').filter(Boolean);const haystack=normalize(text);return words.every(word=>haystack.includes(word));}
  function feedback(data){return ['T-Box 问题反馈（待本人发送）','类别：'+data.kind,'实际软件版本：'+(data.version.trim()||'未填写，请先核对桌面端'),'Windows / 设备：'+(data.os.trim()||'未填写'),'','问题或建议：',data.description.trim(),'','复现步骤：',data.steps.trim()||'未填写','','期望结果 / 实际错误：',data.result.trim()||'未填写','','发送前请再次检查：不要包含完整卡密、API Key、密码、验证码或个人材料。'].join('\n');}
  const api={normalize,matches,feedback};if(typeof module==='object'&&module.exports)module.exports=api;else root.TBOX_PLATFORM=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
