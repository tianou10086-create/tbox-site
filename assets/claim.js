(() => {
  'use strict';
  const api='https://api.tboxapp.top', status=document.getElementById('status'), claim=document.getElementById('claim');
  let expectedAccountId;
  // Keep the bearer credential only in this tab's session storage across login.
  const raw=location.hash.slice(1), key='tbox-pending-claim';
  if (/^[A-Za-z0-9_-]{43}$/.test(raw)) sessionStorage.setItem(key,raw);
  history.replaceState(null,'',location.pathname);
  const token=sessionStorage.getItem(key);
  const login=document.getElementById('login');
  login.href=api+'/account?return_to='+encodeURIComponent('https://tboxapp.top/claim.html');
  async function init(){
    if(!token){status.textContent='此页面缺少有效领取凭证，请重新打开代理发送的完整链接。';return;}
    const r=await fetch(api+'/account/api/session',{credentials:'include'});
    if(r.status===401){status.textContent='请先登录，再回到此页面确认领取。';login.hidden=false;return;}
    if(!r.ok)throw Error('账户服务暂未响应，请稍后重试。');
    const user=await r.json();expectedAccountId=user.account_id;document.getElementById('identity').textContent='当前账户：'+user.email;
    const preview=await fetch(api+'/account/api/reseller/claim-preview',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
    const info=await preview.json();if(!preview.ok)throw Error(info.detail||'凭证核验失败');
    status.textContent=info.name+' · '+info.validity_days+'天。确认账户无误后点击领取。';claim.hidden=false;
  }
  claim.onclick=async()=>{
    claim.disabled=true;
    try{const r=await fetch(api+'/account/api/reseller/claim',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,expected_account_id:expectedAccountId})});
      const data=await r.json();if(!r.ok)throw Error(data.detail||'领取失败');
      sessionStorage.removeItem(key);status.textContent='领取成功。请进入官网账户中心查看权益，再按桌面端原流程激活使用。';claim.hidden=true;
      login.textContent='查看我的会员';login.href=api+'/account';login.hidden=false;
    }catch(e){status.textContent=e.message;claim.disabled=false;}
  };
  init().catch(e=>status.textContent=e.message);
})();
