(() => {
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu=$('#menu-toggle'),mobile=$('#mobile-nav');
  if(menu&&mobile){menu.addEventListener('click',()=>{let open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));mobile.hidden=open});$$('#mobile-nav a').forEach(a=>a.addEventListener('click',()=>{mobile.hidden=true;menu.setAttribute('aria-expanded','false')}))}
  const updateProgress=()=>{let max=document.documentElement.scrollHeight-innerHeight;$('#read-progress').style.width=`${max>0?Math.min(100,scrollY/max*100):0}%`};
  addEventListener('scroll',updateProgress,{passive:true});addEventListener('resize',updateProgress);updateProgress();

  const policies={
    '2023':{title:'校园供餐引起公共关注',body:'教育部就“预制菜进校园”表示审慎态度。校园是特殊供餐场景，不能直接代表一般餐厅的加工和明示情况。',url:'https://www.moe.gov.cn/jyb_xwfb/s5147/202309/t20230922_1082180.html',link:'教育部回应'},
    '2024':{title:'国家层面明确范围，提出推广明示',body:'六部门文件界定预制菜范围，并提出“大力推广餐饮环节使用预制菜明示”。中央厨房参与某一步骤，并不自动使一道餐厅菜品落入该定义。',url:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/spscs/art/2024/art_e1ba9385be204186adc0f2cfef717693.html',link:'六部门文件'},
    '2025':{title:'标准制定与餐饮明示继续推进',body:'国务院食安办公开表示推进预制菜国家标准制定与餐饮环节明示。推进中的标准不能表述为已完成。',url:'https://www.samr.gov.cn/xw/zj/art/2025/art_ff1607d98fc94e6a8e2e9d36c543ae23.html',link:'官方消息'},
    '2026':{title:'明示方案公开征求意见',body:'2026 年 2 月征求意见；7 月反馈称收到 90 条意见，将继续修改并按程序推进。截至 11 月 10 日核验，不能称其已作为强制规定施行。',url:'https://www.samr.gov.cn/hd/zjdc/jgfk/art/2026/art_aee3b8a076f54e029398a1e720e410a3.html',link:'征求意见反馈'}
  };
  function showPolicy(year){const d=policies[year];$$('#policy-timeline button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.year===year)));$('#policy-detail').innerHTML=`<strong>${d.title}</strong><p>${d.body}</p><a href="${d.url}" target="_blank" rel="noopener">${d.link} ↗</a>`}
  $$('#policy-timeline button').forEach(b=>b.addEventListener('click',()=>showPolicy(b.dataset.year)));showPolicy('2024');

  const process=[
    ['原料处理','原料验收后，可能进行清洗、切配或分装。哪些步骤留在门店，需看具体菜品。'],
    ['集中加工','部分菜品可能在中央厨房完成调味或预加工；加工到哪一步，不能只看成品外观。'],
    ['包装与配送','食品可能以冷链等方式运到门店。运输方式与具体加工路线都需要独立核验。'],
    ['门店完成','门店可能复热、调味、炖煮或从原料烹制；菜单应具体说明它完成了什么。']
  ];
  let processIndex=0,processTimer=null;
  $('#process-steps').innerHTML=process.map((x,i)=>`<button type="button" data-step="${i}" aria-pressed="false"><b>${String(i+1).padStart(2,'0')}</b><span>${x[0]}</span></button>`).join('');
  function setProcess(i){processIndex=i;$('#process-count').textContent=`${String(i+1).padStart(2,'0')} / 04`;$('#process-title').textContent=process[i][0];$('#process-copy').textContent=process[i][1];const image=$('.process-image');image.style.backgroundPosition=['15% 70%','48% 35%','88% 18%','88% 80%'][i];image.style.transform=i%2?'scale(1.18)':'scale(1.12)';$$('#process-steps button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.step)===i)))}
  $$('#process-steps button').forEach(b=>b.addEventListener('click',()=>{setProcess(Number(b.dataset.step));stopProcess()}));setProcess(0);
  function stopProcess(){if(processTimer){clearInterval(processTimer);processTimer=null}$('#process-play').textContent='▶ 播放制作路径';$('#process-play').setAttribute('aria-pressed','false')}
  $('#process-play').addEventListener('click',()=>{if(processTimer){stopProcess();return}setProcess(0);$('#process-play').textContent='Ⅱ 暂停动画';$('#process-play').setAttribute('aria-pressed','true');processTimer=setInterval(()=>{if(processIndex>=process.length-1){stopProcess()}else setProcess(processIndex+1)},1900)});
  if(reducedMotion)$('#process-play').textContent='▶ 逐步播放路径';

  const fallbackTags=[['信任',18],['工序',18],['价格',17],['口味',16],['透明',15],['定义',14],['知情权',8],['便利',5],['新鲜度',4],['卫生',4],['安全',3],['校园',3]];
  const tagExplanations={信任:'评论是否表达对餐厅、品牌或信息披露的信任与怀疑。',工序:'评论是否追问中央厨房、门店烹饪、复热等加工步骤。',价格:'评论是否将价格与预期中的加工方式或品质联系起来。',口味:'评论是否评价口感、味道和稳定性。',透明:'评论是否要求公开、标注或说明信息。',定义:'评论是否讨论什么算预制菜、现炒或半成品。',知情权:'评论是否明确谈到消费者事前知道与选择的权利。',便利:'评论是否看重省时、方便等消费价值。',新鲜度:'评论是否提及食材和出餐的新鲜感。',卫生:'评论是否讨论卫生条件。',安全:'评论是否讨论食品安全。',校园:'评论是否指向学生供餐和家长选择。'};
  let commentData=[];
  function showTags(counts){const max=Math.max(...counts.map(x=>x[1]));$('#tag-cloud').innerHTML='';counts.forEach(([tag,n])=>{const b=document.createElement('button');b.type='button';b.textContent=tag;b.dataset.tag=tag;b.setAttribute('aria-pressed','false');b.style.setProperty('--font-size',`${17+27*n/max}px`);b.title=`本批评论中标记 ${n} 次；一条评论可有多个标签`;b.addEventListener('click',()=>{const examples=commentData.filter(c=>c.reason_tags?.includes(tag)).slice(0,2);$$('#tag-cloud button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const detail=$('#tag-detail');detail.textContent='';let strong=document.createElement('strong');strong.textContent=`${tag} · 本批 ${n} 次`;detail.append(strong);let p=document.createElement('p');p.textContent=tagExplanations[tag]||'人工编码的议题标签。';detail.append(p);examples.forEach(c=>{let q=document.createElement('p');q.className='tag-example';q.textContent=`评论释义：${c.comment_text_paraphrase}`;detail.append(q);let a=document.createElement('a');a.href=c.source_url;a.target='_blank';a.rel='noopener';a.textContent='查看相关原帖 ↗';detail.append(a)})});$('#tag-cloud').append(b)})}
  showTags(fallbackTags);
  fetch('舆论数据_第二阶段/公众评论_人工编码样本.json').then(r=>{if(!r.ok)throw Error('data');return r.json()}).then(rows=>{if(!Array.isArray(rows))return;commentData=rows;const counts={};rows.forEach(c=>(c.reason_tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));showTags(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,15))}).catch(()=>{$('#tag-detail').textContent='标签次数来自公开评论编码表；逐条评论详情需要通过网页服务打开。'});

  const cases={
    '四季民福':{title:'四季民福 · 故宫店',fact:'公开报道记录顾客对袋装食材提出疑问；店方解释袋子用于蔬菜分装，并作退款处理。报道不能证明整道菜是否预制。',gap:'需核查具体菜品、当日菜单与门店工序。',url:'https://m.jiemian.com/video/AGUCMQhmB2UBMVVr.html'},
    '西贝':{title:'西贝 · 北京门店线索',fact:'2025 年争议后，品牌公开部分菜品制作说明。公开工序与菜单上能否餐前看到，是两件需要分别核查的事。',gap:'逐道保存门店菜单与点餐页，核对标注时间。',url:'https://m.bjnews.com.cn/detail/1757666301168076.html'},
    '萨莉亚':{title:'萨莉亚 · 北京门店待选',fact:'公司官网介绍工厂承担食材加工、烹调与配送。定向评论中也有认可其便宜、方便和口味的声音。',gap:'不能据公司层面的资料推断北京每道菜的工序或明示状态。',url:'https://www.saizeriya.co.jp/corporate/recruitment-information/'},
    '老乡鸡':{title:'老乡鸡 · 北京门店待选',fact:'公开资料曾分类说明现做、半预制和复热等工序，给逐菜说明提供了参考。',gap:'需要核对这些分类是否出现在具体门店点餐界面。',url:'https://file.digitaling.com/eImg/uimages/20240416/1713238142809798.pdf'},
    '绿茶餐厅':{title:'绿茶餐厅 · 北京门店待选',fact:'公开报道讨论过门店“无预制菜／现点现做”等宣传文字的变化。文字变化不等于对实际工序的独立核验。',gap:'需保存菜单与宣传文案，并询问具体菜品。',url:'https://finance.sina.com.cn/chanjing/2025-09-19/doc-infqytkw5164448.shtml'}
  };
  $('#case-tabs').innerHTML=Object.keys(cases).map((name,i)=>`<button type="button" data-case="${name}" role="tab" aria-selected="${i===0}">${name}</button>`).join('');
  function showCase(name){let x=cases[name];$$('#case-tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.case===name)));$('#case-content').innerHTML=`<h5>${x.title}</h5><p><strong>公开资料：</strong>${x.fact}</p><p><strong>下一步核验：</strong>${x.gap}</p><a href="${x.url}" target="_blank" rel="noopener">查看来源 ↗</a>`}
  $$('#case-tabs button').forEach(b=>b.addEventListener('click',()=>showCase(b.dataset.case)));showCase('四季民福');

  $('#dish-units').innerHTML=Array.from({length:90},(_,i)=>`<span title="第 ${i+1} 道计划调查菜品：尚未采集"></span>`).join('');
  $('#matrix-grid').innerHTML=Array.from({length:30},(_,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b>${['加工方式','加工地点','预处理环节'].map(field=>`<button type="button" data-row="${i+1}" data-field="${field}" aria-label="计划调查餐厅 ${i+1}：${field}，待采"></button>`).join('')}</div>`).join('');
  $$('#matrix-grid button').forEach(b=>b.addEventListener('click',()=>{$('#matrix-detail').textContent=`计划调查餐厅 ${b.dataset.row} · ${b.dataset.field}：尚未采集。正式图将附上菜单截图、采集日期与编码依据。`}));
  $$('.mini-bars>div[data-pct]').forEach(x=>{x.querySelector('i').style.setProperty('--pct',x.dataset.pct+'%')});
  const scenarios={fast:'在这份 2024 年样本中，连锁快餐店的“接受”比例为 53.5%。这仅是该问卷题目的回答，不表示快餐店实际使用率。',ordinary:'普通餐厅的“接受”比例为 28.4%。与快餐店相比，受访者可能有不同的价格和工序预期；现有图不能证明原因。',high:'高档餐厅的“接受”比例为 8.8%。这一差异提示场景值得单独问，但不能推断某家高档餐厅的经营状况。'};
  $$('#scenario-heat button').forEach(b=>b.addEventListener('click',()=>{$$('#scenario-heat button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#scenario-detail').textContent=scenarios[b.dataset.scene]}));

  const choiceFeedback={A:['你选了信息最少的一份','菜名、图片和价格能够吸引人，但还不足以判断主要食材在哪里加工、门店完成了什么。现在把缺失的信息补给你。'],B:['你选择了说明中央厨房参与的一份','菜单说明了一部分制作路径。你仍可以继续追问：预处理到哪一步、门店最后做了什么。'],C:['你选择了说明门店工序的一份','你知道这道菜从原料开始在门店加工；这可能更符合你的预期。选择本身不代表其他加工方式不安全。']};
  $$('#choice-cards button').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.choice;$$('#choice-cards button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const feedback=$('#choice-feedback');feedback.hidden=false;feedback.innerHTML=`<strong>${choiceFeedback[key][0]}</strong><p>${choiceFeedback[key][1]}</p>`;const second=$('#second-round');second.hidden=key!=='A';$$('.second-options button').forEach(x=>x.setAttribute('aria-pressed','false'));$('#second-feedback').textContent='';feedback.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'center'})}));
  const secondFeedback={still:'继续选择也合理：你已经获得更多信息，可以把价格、口味和便利一起纳入判断。',change:'改变选择也合理：加工地点和工序与你原先的预期不同。关键是这次决定发生在知情之后。',ask:'继续追问也合理：一句“中央厨房预处理”仍可能不足以说明预处理程度和门店实际工序。'};
  $$('.second-options button').forEach(b=>b.addEventListener('click',()=>{$$('.second-options button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#second-feedback').textContent=secondFeedback[b.dataset.second]}));
})();
