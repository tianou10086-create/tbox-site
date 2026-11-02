(() => {
  const samples = {
    prepare: ['面试准备 / 表达结构','说一个你推动改进的例子。','先找到真实经历，再组织表达。',['01 背景','问题发生在哪里？','02 行动','你具体做了什么？','03 结果','什么发生了变化？']],
    practice: ['题面分析 / 推理过程','先把问题拆开。','读清条件，再复核推理。',['01 条件','列出题目给出的信息。','02 推理','检查每一步是否有依据。','03 复核','把结论代回原题。']],
    library: ['材料整理 / 当前上下文','需要的材料，放在一起。','从真实材料出发，不凭空补经历。',['01 收集','选择与任务有关的材料。','02 整理','保留来源和关键要点。','03 使用','核对后带入当前问题。']]
  };
  document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
    const data = samples[button.dataset.demo];
    document.querySelectorAll('[data-demo]').forEach(b => { b.classList.toggle('selected',b===button); b.setAttribute('aria-pressed',String(b===button)); });
    ['demo-kicker','demo-title','demo-description'].forEach((id,i)=>document.getElementById(id).textContent=data[i]);
    const answer=document.getElementById('demo-answer'); answer.replaceChildren();
    for(let i=0;i<6;i+=2){const p=document.createElement('p'),b=document.createElement('b');b.textContent=data[3][i];p.append(b,document.createTextNode(data[3][i+1]));answer.append(p);}
  }));
})();
