(() => {
  'use strict';
  const api='https://api.tboxapp.top', $=id=>document.getElementById(id), money=n=>'¥'+(n/100).toFixed(2);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  async function request(path,body){const r=await fetch(api+'/account/api/reseller/'+path,{credentials:'include',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){const e=Error(data.detail||'服务暂不可用');e.status=r.status;throw e;}return data;}
  async function action(button,fn){button.disabled=true;try{await fn();}catch(e){$('status').textContent=e.message;}finally{button.disabled=false;}}
  function image(parent,data,label){if(!data)return;const img=el('img');img.src='data:image/png;base64,'+data;img.alt=label;parent.append(img);}
  async function orders(){const data=await request('orders');$('orders').replaceChildren();let paid=0,claimed=0;
    for(const o of data.orders){const row=el('article');row.className='order';
      const statuses={paid:'已付款',pending:'待付款',payment_unknown:'付款待核实',cancelled:'已取消',expired:'已超时'};
      row.append(el('h3',o.sku+' · '+money(o.amount_cents)),el('p','订单 '+o.id+' · '+(o.refund_state?'售后处理中':statuses[o.status]||o.status)));
      if(o.status==='paid'){paid+=o.amount_cents;if(o.claimed_at)claimed++;}
      if(o.status==='paid'||o.status==='cancelled')sessionStorage.removeItem('tbox-reseller-order-'+o.sku);
      if(o.claimed_at)row.append(el('p','已领取 · '+new Date(o.claimed_at).toLocaleString()));
      if(o.claim_url){row.append(el('p','会员领取二维码 — 私下发送给一位客户'));image(row,o.claim_qrcode_base64,'会员领取二维码');const input=el('input');input.readOnly=true;input.value=o.claim_url;input.setAttribute('aria-label','会员领取链接');row.append(input);const copy=el('button','复制领取链接');copy.className='button button-quiet';copy.onclick=()=>action(copy,async()=>{await navigator.clipboard.writeText(o.claim_url);$('status').textContent='已复制领取链接。';});row.append(copy);}
      if(o.cashier_url){row.append(el('p','代理采购付款码 — 不要发给客户'));image(row,o.qrcode_base64,'代理采购付款二维码');}
      if(o.status!=='paid'&&o.status!=='cancelled'){const refresh=el('button','核对原订单付款状态');refresh.className='button button-quiet';refresh.onclick=()=>action(refresh,async()=>{await request('orders/'+encodeURIComponent(o.id)+'/refresh',{});await orders();});row.append(refresh);}
      $('orders').append(row);
    }
    $('summary').textContent=`本页已付采购额 ${money(paid)} · 已领取 ${claimed} 份 · 未领取已付 ${data.orders.filter(o=>o.status==='paid'&&!o.claimed_at&&!o.refund_state).length} 份`;
    if(!data.orders.length)$('orders').append(el('p','还没有采购记录。'));
  }
  async function init(){
    const c=await request('catalog');$('workspace').hidden=false;$('status').textContent=c.active?(c.enabled?'代理资格已开通。':'代理中心已配置，采购暂未开放。'):'代理资格已停用；历史记录仍可查看。';
    for(const p of c.products){const card=el('article');card.className='panel';card.append(el('h3',p.name),el('p','官网零售价 '+money(p.retail_cents)),el('h2','我的拿货价 '+money(p.price_cents)));
      const buy=el('button',p.purchasing_open?'采购一份':'暂未开放采购');buy.className='button';buy.disabled=!p.purchasing_open;
      buy.onclick=()=>action(buy,async()=>{if(!$('terms').checked)throw Error('请先阅读并确认交付与售后规则。');const key='tbox-reseller-order-'+p.sku;let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id);}const result=await request('orders',{sku:p.sku,request_id:id});if(result.status==='paid'||result.status==='cancelled')sessionStorage.removeItem(key);await orders();$('status').textContent='已恢复采购订单，请在原订单内付款或查询。';});card.append(buy);$('products').append(card);}
    await orders();
  }
  $('reload').onclick=()=>action($('reload'),orders);
  $('login').href=api+'/account?return_to='+encodeURIComponent('https://tboxapp.top/reseller.html');
  init().catch(e=>{$('status').textContent=e.message;if(e.status===401)$('login').hidden=false;});
})();
