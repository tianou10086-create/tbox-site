(() => {
  'use strict';
  const api='https://api.tboxapp.top', $=id=>document.getElementById(id), money=n=>'¥'+(n/100).toFixed(2);
  let accountId='';
  const orderKey=sku=>'tbox-reseller-order:'+accountId+':'+sku;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  async function fetchJson(url,body){
    const r=await fetch(url,{credentials:'include',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    let data;try{data=await r.json();}catch{const e=Error(r.status===401?'请先登录':'服务暂未返回有效结果，请稍后刷新原订单，不要重复付款。');e.status=r.status;throw e;}
    if(!r.ok){const e=Error(typeof data.detail==='string'?data.detail:'请求未成功，请稍后刷新原订单。');e.status=r.status;throw e;}return data;
  }
  const request=(path,body)=>fetchJson(api+'/account/api/reseller/'+path,body);
  async function action(button,fn){button.disabled=true;try{await fn();}catch(e){$('status').textContent=e.message;}finally{button.disabled=false;}}
  function image(parent,data,label,mime='image/png'){if(!data||!['image/png','image/jpeg'].includes(mime))return;const img=el('img');img.src='data:'+mime+';base64,'+data;img.alt=label;parent.append(img);}
  async function orders(){const data=await request('orders');$('orders').replaceChildren();let paid=0,claimed=0;
    for(const o of data.orders){const row=el('article');row.className='order';
      const statuses={paid:'已付款',pending:'待付款',pending_review:'已提交付款参考，待实收审核',payment_unknown:'付款待核实',cancelled:'已取消',expired:'已超时'};
      row.append(el('h3',o.sku+' · '+money(o.amount_cents)),el('p','订单 '+o.id+' · '+(o.refund_state==='refunded_manual'?'已登记全额退款 · 权益已停用':o.refund_state?'售后处理中':statuses[o.status]||o.status)));
      if(o.status==='paid'){paid+=o.amount_cents;if(o.claimed_at)claimed++;}
      const key=orderKey(o.sku);
      if((o.status==='paid'||o.status==='cancelled')&&sessionStorage.getItem(key+':id')===o.id){sessionStorage.removeItem(key);sessionStorage.removeItem(key+':id');}
      if(o.claimed_at)row.append(el('p','已领取 · '+new Date(o.claimed_at).toLocaleString()));
      if(o.claim_url){row.append(el('p','会员领取二维码 — 私下发送给一位客户'));image(row,o.claim_qrcode_base64,'会员领取二维码');const input=el('input');input.readOnly=true;input.value=o.claim_url;input.setAttribute('aria-label','会员领取链接');row.append(input);const copy=el('button','复制领取链接');copy.className='button button-quiet';copy.onclick=()=>action(copy,async()=>{await navigator.clipboard.writeText(o.claim_url);$('status').textContent='已复制领取链接。';});row.append(copy);}
      if(o.qrcode_base64){row.append(el('p','代理采购付款码 — 不要发给客户'));image(row,o.qrcode_base64,'代理采购付款二维码',o.image_mime||'image/png');}
      if(o.payment_channel==='free_receipt'&&o.status!=='paid'&&!o.refund_state){
        row.append(el('p',o.instructions||'按本订单金额扫码付款后提交微信付款参考号；负责人核对真实到账和订单归属后发放领取凭证，提交参考号不等于付款已确认。'));
        if(o.status==='pending_review')row.append(el('p','付款参考已提交，请等待审核，不要再次付款。'));
        else if(o.status!=='cancelled'){
          const form=el('form'),label=el('label','已付款：微信交易单号 / 付款参考号'),input=el('input');input.required=true;input.minLength=4;input.maxLength=200;label.append(input);
          const send=el('button','提交付款参考，等待核实');send.type='submit';send.className='button button-quiet';form.append(label,send);
          form.onsubmit=e=>{e.preventDefault();action(send,async()=>{await request('orders/'+encodeURIComponent(o.id)+'/receipt-claim',{transaction_reference:input.value.trim()});await orders();$('status').textContent='参考号已提交，负责人核对实收后才会发放领取凭证。';});};row.append(form);
          if(!o.qrcode_base64){const resume=el('button','尚未付款：恢复原订单付款码');resume.type='button';resume.className='button button-quiet';resume.onclick=()=>action(resume,async()=>{if(!confirm('确认这笔订单尚未付款？已付款请取消并提交原付款参考号，不要重复付款。'))return;await request('orders/'+encodeURIComponent(o.id)+'/resume',{confirmed_unpaid:true});await orders();});row.append(resume);}
        }
      }
      if(o.status!=='paid'&&o.status!=='cancelled'){const refresh=el('button',o.payment_channel==='free_receipt'?'刷新实收审核结果':'核对原订单付款状态');refresh.className='button button-quiet';refresh.onclick=()=>action(refresh,async()=>{await request('orders/'+encodeURIComponent(o.id)+'/refresh',{});await orders();});row.append(refresh);}
      $('orders').append(row);
    }
    $('summary').textContent=`本页累计已付（含已退款）${money(paid)} · 已领取 ${claimed} 份 · 未领取已付 ${data.orders.filter(o=>o.status==='paid'&&!o.claimed_at&&!o.refund_state).length} 份`;
    if(!data.orders.length)$('orders').append(el('p','还没有采购记录。'));
  }
  async function init(){
    accountId=(await fetchJson(api+'/account/api/session')).account_id;
    const c=await request('catalog');$('workspace').hidden=false;$('status').textContent=c.active?(c.enabled?'代理资格已开通。':'代理中心已配置，采购暂未开放。'):'代理资格已停用；历史记录仍可查看。';
    for(const p of c.products){const card=el('article');card.className='panel';card.append(el('h3',p.name),el('p','官网零售价 '+money(p.retail_cents)),el('h2','我的拿货价 '+money(p.price_cents)));
      const buy=el('button',p.purchasing_open?'采购一份':'暂未开放采购');buy.className='button';buy.disabled=!p.purchasing_open;
      buy.onclick=()=>action(buy,async()=>{if(!$('terms').checked)throw Error('请先阅读并确认交付与售后规则。');if((await fetchJson(api+'/account/api/session')).account_id!==accountId)throw Error('登录账户已变化，请刷新页面后重新核对报价。');const key=orderKey(p.sku);let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id);}const result=await request('orders',{sku:p.sku,request_id:id});sessionStorage.setItem(key+':id',result.id);if(result.status==='paid'||result.status==='cancelled'){sessionStorage.removeItem(key);sessionStorage.removeItem(key+':id');}await orders();$('status').textContent='已恢复采购订单，请在原订单内付款或查询。';});card.append(buy);$('products').append(card);}
    await orders();
  }
  $('reload').onclick=()=>action($('reload'),orders);
  $('login').href=api+'/account?return_to='+encodeURIComponent('https://tboxapp.top/reseller.html');
  init().catch(e=>{$('status').textContent=e.message;if(e.status===401)$('login').hidden=false;});
})();
