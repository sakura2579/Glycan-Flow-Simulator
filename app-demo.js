// Expects global window.GlycanForward (injected from glycan-solver.mjs)
// and window.GlycanInverseFixture (Python-verified data).
const {BASE_EDGES,solveForward,capacitiesFromPercent,maxFlow,validateForwardResult,INVERSE_TARGET}=window.GlycanForward;
const inv=window.GlycanInverseFixture;
// Inverse画面の説明数値は検証済みfixtureから取得（手入力の数字と不整合にしない）。
const correctionId='E13';
const originalCorrection=inv.baselineCapacity[correctionId];
const correctedCorrection=inv.correctedCapacity[correctionId];
const requiredTerminalC=inv.maxFlow*inv.target.C;
const numberLabel=n=>Number.isInteger(n)?String(n):n.toFixed(1);
function initInverseExplanation(){
  const el=$('inverseCapLive');
  if(el)el.textContent=numberLabel(originalCorrection);
  if($('inverseResultTotalFlow'))$('inverseResultTotalFlow').textContent=numberLabel(inv.maxFlow);
}

const coords={input:[90,325],core:[260,325],high:[445,198],branch:[445,325],stall:[445,449],extend:[635,258],finish:[635,392],A:[865,185],B:[865,325],C:[865,461]};
const names={UQ:'各反応の流量の偏りを抑える方法です。',CWQ:'反応容量が大きい経路を使いやすくする方法です。',SU:'各反応の容量をどれくらい使っているかを考慮します。',LCRQ:'分岐点での反応容量の比率を考慮します。'};
const ID_LIST=BASE_EDGES.map(x=>x[0]);
const state={mode:'forward',selected:'E13',percent:{},method:'CWQ',manual:null,adjusted:false,hasAdjusted:false,hasChangedMethod:false,referenceGap:null,feedback:null,exampleActive:false};
const svg=document.getElementById('network');const ns='http://www.w3.org/2000/svg';const $=id=>document.getElementById(id);
const edges=new Map();let queued=false;
let comparisonOpen=false;
let comparisonScenario='showcase';
// 教育目的で差が見えやすい容量条件。4手法は全く同じ容量を使って実際に最適化する。
// 25%-200%はすべてスライダーの可動範囲内。数値や棒の長さは手入力ではない。
const COMPARE_SHOWCASE=Object.freeze({E5:25,E8:150,E7:200,E11:25,E9:150,E13:200});
const comparisonCache=new Map();
let savedManualBeforeExample=null;
let playbackTimer=null;
let playingIndex=-1;
const PLAY_SEQUENCE=['UQ','CWQ','SU','LCRQ'];
function stopPlayback(){
  if(playbackTimer!==null){clearInterval(playbackTimer);playbackTimer=null;}
  const btn=$('playMethods');if(btn){btn.setAttribute('aria-pressed','false');btn.textContent='▶ 4手法の変化を見る';}
}
function updateQuickRestore(){
  if($('restoreManualQuick'))$('restoreManualQuick').hidden=savedManualBeforeExample===null;
}
function closeComparison(){
  comparisonOpen=false;
  $('compareMethods').setAttribute('aria-expanded','false');
  $('compareMethods').textContent='数値一覧';
  $('methodComparison').hidden=true;
}
function comparisonResults(){
  if(!comparisonCache.has(comparisonScenario)){
    const p=comparisonScenario==='showcase'?COMPARE_SHOWCASE:{};
    comparisonCache.set(comparisonScenario,['UQ','CWQ','SU','LCRQ'].map(method=>({method,result:solveForward(p,method)})));
  }
  return comparisonCache.get(comparisonScenario);
}
function renderComparison(){
  if(!comparisonOpen)return;
  const rows=comparisonResults();
  for(const b of document.querySelectorAll('[data-compare-scenario]'))b.setAttribute('aria-pressed',String(b.dataset.compareScenario===comparisonScenario));
  const isShowcase=comparisonScenario==='showcase';
  $('applyShowcase').hidden=!isShowcase;
  $('restoreManual').hidden=savedManualBeforeExample===null;
  $('compareScenarioNote').textContent=isShowcase
    ?'4手法とも共通の容量で再計算しています。'
    :'全反応を初期容量100%にしています。';
  const range=['A','B','C'].map(k=>({name:k,delta:100*(Math.max(...rows.map(r=>r.result.profile[k]))-Math.min(...rows.map(r=>r.result.profile[k])))})).sort((a,b)=>b.delta-a.delta)[0];
  $('compareDelta').textContent=`糖鎖${range.name}：${range.delta.toFixed(1)} ポイント差`;
  const container=$('comparisonResults');container.replaceChildren();
  for(const {method,result} of rows){
    const row=document.createElement('div');row.className='compare-item';
    const label=document.createElement('span');label.className='compare-item-name';label.textContent=method;
    const stack=document.createElement('div');stack.className='compare-stack';
    const values=document.createElement('div');values.className='compare-values';
    for(const k of ['A','B','C']){
      const segment=document.createElement('span');segment.className='compare-segment compare-'+k;
      segment.style.width=(100*result.profile[k])+'%';stack.append(segment);
      const value=document.createElement('span');value.textContent=k+' '+fmt(100*result.profile[k])+'%';values.append(value);
    }
    row.append(label,stack,values);container.append(row);
  }
}

const el=(tag,attrs={})=>{const item=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))item.setAttribute(k,String(v));return item};
function pathFor(a,b){const p=coords[a],q=coords[b],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy)||1, ux=dx/len,uy=dy/len;const start=45,end= (['A','B','C'].includes(b)?35:45), sx=p[0]+ux*start,sy=p[1]+uy*start,tx=q[0]-ux*end,ty=q[1]-uy*end;if(Math.abs(tx-sx)<18)return `M${sx.toFixed(1)} ${sy.toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)}`;return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx+72).toFixed(1)} ${sy.toFixed(1)},${(tx-72).toFixed(1)} ${ty.toFixed(1)},${tx.toFixed(1)} ${ty.toFixed(1)}`;}
for(const [id,a,b] of BASE_EDGES){const d=pathFor(a,b);const g=el('g');const line=el('path',{d,class:'edge-line'});const pulse=el('path',{d,class:'edge-pulse'});const hit=el('path',{d,class:'edge-hit'});const mid=[(coords[a][0]+coords[b][0])/2,(coords[a][1]+coords[b][1])/2];const target=el('circle',{cx:mid[0],cy:mid[1],r:17,class:'edge-target',tabindex:0,role:'button','aria-label':`反応 ${id} を選択`});const title=el('title');title.textContent=`反応 ${id}`;target.append(title);hit.addEventListener('click',()=>pick(id));target.addEventListener('click',()=>pick(id));target.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(id)}});g.append(line,pulse,hit,target);svg.append(g);edges.set(id,{line,pulse,hit,target});}
for(const [id,point] of Object.entries(coords)){const t=['A','B','C'].includes(id);const shape=el('circle',{cx:point[0],cy:point[1],r:t?32:23,class:t?`node terminal-${id}`:'node'});svg.append(shape);const text=el('text',{x:point[0],y:point[1]+5,class:`node-txt${t?' term-txt':''}`});text.textContent=t?`糖鎖${id}`:({'input':'始点','core':'分岐','high':'中間','branch':'中間','stall':'中間','extend':'中間','finish':'中間'})[id];if(t){text.setAttribute('font-size','13');text.setAttribute('textLength','55');text.setAttribute('lengthAdjust','spacingAndGlyphs');}else{text.setAttribute('font-size','12')}svg.append(text);}
function gap(profile){return ['A','B','C'].reduce((s,k)=>s+Math.abs(100*(profile[k]-inv.target[k])),0)/2;}
const fmt = n=>Number.isFinite(n)?n.toFixed(1):'—';
function pick(id){if(state.mode!=='forward')return;stopPlayback();state.selected=id;sync();}
function getManual(){return solveForward(state.percent,state.method);}
function currentGap(){const r=getManual();return r.maxFlow>0?gap(r.profile):null;}
function feedbackFrom(before,after,kind){
  if(before===null || after===null)return {kind:'same',text:'生成量が0の場合、割合のズレは計算できません。別の容量を試してみましょう。'};
  const delta=before-after;
  if(delta>0.05)return {kind:'better',text:`${kind}で ${fmt(delta)} ポイント目標に近づきました！`};
  if(delta< -0.05)return {kind:'worse',text:`${kind}で ${fmt(-delta)} ポイント遠ざかりました。別の設定も試してみよう！`};
  return {kind:'same',text:`${kind}ではズレがほとんど変わりませんでした。ほかの線や方法を試そう！`};
}
function showFeedback(value){
  const label=$('changeFeedback');
  label.className='change-feedback '+(value?.kind??'same');
  label.textContent=value?.text??'まずは黄色い線を動かしてみましょう！';
}

function setMode(mode){if(mode===state.mode)return;stopPlayback();$('playStatus').hidden=true;if(mode==='inverse'){try{state.manual=getManual()}catch(e){$('status').textContent='計算中の結果を保存できませんでした：'+e.message;return}state.adjusted=false;}state.mode=mode;sync();}
function getFlows(){if(state.mode==='forward')return getManual().flows;if(state.adjusted)return inv.inverseFlows;return state.manual.flows;}
function renderEdges(flows){for(const id of ID_LIST){const f=Math.max(0,flows[id]||0),{line,pulse}=edges.get(id);line.style.strokeWidth=String(2.5+Math.min(16,f/7));line.style.opacity=f<0.01?'0.15':'1';pulse.style.opacity=f<0.1?'0':'0.7';line.classList.toggle('selected',state.mode==='forward'&&id===state.selected);line.classList.toggle('corrected',state.mode==='inverse'&&state.adjusted&&id==='E13');}}
function bars(predict,auto){
  const container=$('distribution');
  const sameShape=container.children.length===3 && [...container.children].every(block=>block.querySelectorAll('.bar-row').length===(auto?3:2));
  if(!sameShape){
    container.replaceChildren();
    for(const k of ['A','B','C']){
      const block=document.createElement('section');block.className='glycan';
      const heading=document.createElement('div');heading.className='glycan-name';heading.textContent='糖鎖 '+k;block.append(heading);
      for(const [label,sty] of [['目標','bar-target'],['手動','bar-manual'],...(auto?[['Inverse','bar-auto']]:[])]){
        const row=document.createElement('div');row.className='bar-row';
        const tx=document.createElement('label');tx.textContent=label;
        const track=document.createElement('div');track.className='bartrack';
        const fill=document.createElement('div');fill.className='barfill '+sty;fill.style.width='0%';track.append(fill);
        const value=document.createElement('span');row.append(tx,track,value);block.append(row);
      }
      container.append(block);
    }
  }
  for(const [i,k] of ['A','B','C'].entries()){
    const data=[inv.target[k]*100,predict[k]*100,...(auto?[inv.inverseProfile[k]*100]:[])];
    const rows=container.children[i].querySelectorAll('.bar-row');
    for(let n=0;n<data.length;n++){
      const value=data[n];rows[n].querySelector('span').textContent=fmt(value)+'%';
      const fill=rows[n].querySelector('.barfill');
      if(sameShape)fill.style.width=Math.max(0,Math.min(100,value))+'%';
      else requestAnimationFrame(()=>{fill.style.width=Math.max(0,Math.min(100,value))+'%';});
    }
  }
}
function render(){try{const isInv=state.mode==='inverse';document.body.classList.toggle('forward-screen',!isInv);$('forwardTab').setAttribute('aria-pressed',String(!isInv));$('inverseTab').setAttribute('aria-pressed',String(isInv));$('forwardControl').hidden=isInv;$('inverseControl').hidden=!isInv;$('methodsArea').hidden=isInv;$('inverseHeading').hidden=!isInv;$('inverseKey').hidden=!(isInv&&state.adjusted);$('inverseLegend').hidden=!(isInv&&state.adjusted);$('toInverse').hidden=isInv;$('toForward').hidden=!isInv;$('networkState').textContent=isInv?(state.adjusted?'補正後の流量':'手動調整の結果'):'手動操作中';$('modeCaption').textContent=isInv?'手動のズレ':'目標とのズレ';$('methodDescription').textContent=names[state.method];
$('firstTip').hidden=isInv;
$('changeFeedback').hidden=isInv;
$('inverseNudge').hidden=isInv;
$('inverseNudgeFoot').hidden=isInv;$('inverseResultNote').hidden=!isInv||!state.adjusted;
if(!isInv){
  $('firstTipTitle').textContent=state.hasAdjusted?'💡 ほかの線や計算方法も試してみよう！':'💡 まず黄色い線 E13 の容量を増やしてみよう！';
  $('firstTipDetail').textContent=state.hasAdjusted?'黄色の線を選んで容量を変えると、予測分布がどう変わるか確かめられます。':'100%から150%に動かすと、目標に少し近づきます。';
  $('methodPrompt').textContent=state.exampleActive?'4手法のボタンを切り替えて、流れの違いを見よう！':state.hasAdjusted?'次は4手法の変化を見てみよう。':'まず容量を動かしてみよう。';
}
for(const btn of $('methods').querySelectorAll('[data-method]'))btn.setAttribute('aria-pressed',String(btn.dataset.method===state.method));
let manual=isInv?state.manual:getManual();if(!manual)manual=getManual();const flows=isInv&&state.adjusted?inv.inverseFlows:manual.flows;renderEdges(flows);const profile=manual.profile;const manualGap=manual.maxFlow>0?gap(profile):null;
$('totalFlow').textContent=fmt(isInv&&state.adjusted?inv.maxFlow:manual.maxFlow);
$('gapHeadline').textContent=manualGap==null?'—':fmt(manualGap);$('gapUnit').textContent=manualGap==null?'':' pt';
if(isInv){
  $('autoCorrect').hidden=state.adjusted;
  $('backBefore').hidden=!state.adjusted;
  $('capacityChange').hidden=!state.adjusted;
  $('inverseResultNote').hidden=!state.adjusted;
  $('inverseCapLive').textContent=numberLabel(state.adjusted?correctedCorrection:originalCorrection);
  $('inverseCapLive').classList.toggle('corrected',state.adjusted);
  $('inverseCapLiveBar').style.width=(100*(state.adjusted?correctedCorrection:originalCorrection)/80)+'%';
  $('inverseCapLiveBar').classList.toggle('corrected',state.adjusted);
  $('inverseCapDelta').hidden=!state.adjusted;
  $('inverseCapDelta').textContent='+'+numberLabel(correctedCorrection-originalCorrection);
  $('modeCaption').textContent=state.adjusted?'Inverseの解と観測のズレ':'手動と観測のズレ';
  $('gapHeadline').textContent=state.adjusted?fmt(gap(inv.inverseProfile)):(manualGap===null?'—':fmt(manualGap));
  $('gapHeading').textContent='観測とのズレ';
  $('gapNumber').textContent=state.adjusted?`${fmt(gap(inv.inverseProfile))} pt`:(manualGap===null?'—':`${fmt(manualGap)} pt`);
  $('gapDescription').textContent=state.adjusted?'※補正容量でForwardを再計算した結果ではなく、観測分布を再現できる流量の例です。':'左のボタンで、必要な容量補正を見てみよう。';
  bars(profile,state.adjusted);
}else{const percent=state.percent[state.selected]??100,idx=ID_LIST.indexOf(state.selected),cap=capacitiesFromPercent(state.percent);$('selectedEdgeLabel').textContent=`反応 ${state.selected} の容量を変えよう`;$('capacityPercentage').textContent=`${percent}%`;$('capacitySlider').value=String(percent);$('selectedCapacity').textContent=fmt(cap[idx]);$('selectedFlow').textContent=fmt(manual.flows[state.selected]);$('gapHeading').textContent='目標まであと';$('gapNumber').textContent=manualGap==null?'—':`${fmt(manualGap)} pt`;$('gapDescription').textContent=manualGap==null?'総流量が0のため、生成割合は計算できません。':'差は糖鎖A/B/Cの割合のずれをまとめた値です。小さいほど目標に近づきます。';showFeedback(state.referenceGap===null?state.feedback:feedbackFrom(state.referenceGap,manualGap,'容量変更'));bars(profile,false);
}
$('status').textContent='';}catch(e){$('status').textContent='計算できませんでした：'+e.message;}}
function sync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
$('capacitySlider').addEventListener('input',e=>{
  stopPlayback();
  if(state.referenceGap===null)state.referenceGap=currentGap();
  state.percent[state.selected]=Number(e.target.value);
  state.exampleActive=false;
  state.hasAdjusted=true;
  sync();
});
$('capacitySlider').addEventListener('change',()=>{
  state.feedback=feedbackFrom(state.referenceGap,currentGap(),'容量変更');
  state.referenceGap=null;
  sync();
});
for(const btn of $('methods').querySelectorAll('[data-method]'))btn.addEventListener('click',()=>{
  stopPlayback();$('playStatus').hidden=true;
  if(state.method===btn.dataset.method)return;
  const oldGap=currentGap();
  state.method=btn.dataset.method;
  state.hasChangedMethod=true;
  state.feedback=feedbackFrom(oldGap,currentGap(),'計算方法の切り替え');
  state.referenceGap=null;
  sync();
});
$('compareMethods').addEventListener('click',()=>{stopPlayback();
  comparisonOpen=!comparisonOpen;
  $('compareMethods').setAttribute('aria-expanded',String(comparisonOpen));
  $('compareMethods').textContent=comparisonOpen?'閉じる':'数値一覧';
  $('methodComparison').hidden=!comparisonOpen;
  try{renderComparison()}catch(e){$('status').textContent='比較の計算ができませんでした：'+e.message;}
});
for(const b of document.querySelectorAll('[data-compare-scenario]'))b.addEventListener('click',()=>{
  comparisonScenario=b.dataset.compareScenario;
  try{renderComparison()}catch(e){$('status').textContent='比較の計算ができませんでした：'+e.message;}
});
$('applyShowcase').addEventListener('click',()=>{
  if(savedManualBeforeExample===null){
    savedManualBeforeExample={percent:{...state.percent},selected:state.selected,method:state.method,hasAdjusted:state.hasAdjusted,hasChangedMethod:state.hasChangedMethod};
  }
  state.percent={...COMPARE_SHOWCASE};state.selected='E13';state.exampleActive=true;
  state.hasAdjusted=true;state.referenceGap=null;
  state.feedback={kind:'same',text:'比較用の容量を適用しました。4手法を順番に選んでみよう！比較画面から元の設定に戻せます。'};
  closeComparison();updateQuickRestore();sync();
});
$('restoreManual').addEventListener('click',()=>{stopPlayback();
  if(!savedManualBeforeExample)return;
  const s=savedManualBeforeExample;
  state.percent=s.percent;state.selected=s.selected;state.method=s.method;
  state.hasAdjusted=s.hasAdjusted;state.hasChangedMethod=s.hasChangedMethod;
  state.exampleActive=false;state.referenceGap=null;
  state.feedback={kind:'same',text:'比較例から元の手動設定に戻しました。'};
  savedManualBeforeExample=null;
  closeComparison();updateQuickRestore();sync();
});
$('reset').addEventListener('click',()=>{stopPlayback();
  state.percent={};state.selected='E13';state.method='CWQ';
  state.hasAdjusted=false;state.hasChangedMethod=false;state.referenceGap=null;state.exampleActive=false;savedManualBeforeExample=null;
  state.feedback={kind:'same',text:'初期状態に戻しました。まずは黄色い線の容量を増やしてみましょう！'};
  updateQuickRestore();sync();
});
$('forwardTab').addEventListener('click',()=>setMode('forward'));$('inverseTab').addEventListener('click',()=>setMode('inverse'));$('toInverse').addEventListener('click',()=>setMode('inverse'));$('toForward').addEventListener('click',()=>setMode('forward'));
$('autoCorrect').addEventListener('click',()=>{state.adjusted=true;sync()});$('backBefore').addEventListener('click',()=>{state.adjusted=false;sync()});
$('playMethods').addEventListener('click',()=>{
  if(playbackTimer!==null){stopPlayback();return;}
  // v8と同じ検証済みの共通容量設定を適用し、4手法を順番に実際に解く。
  $('applyShowcase').click();
  playingIndex=0;
  state.method=PLAY_SEQUENCE[playingIndex];
  state.hasChangedMethod=true;
  state.referenceGap=null;
  $('playStatus').hidden=false;
  $('playStatus').textContent='同じ容量で、UQ → CWQ → SU → LCRQ を切り替えています';
  $('playMethods').setAttribute('aria-pressed','true');
  $('playMethods').textContent='■ 再生を止める';
  sync();
  playbackTimer=setInterval(()=>{
    playingIndex++;
    if(playingIndex>=PLAY_SEQUENCE.length){stopPlayback();$('playStatus').textContent='手法ボタンを押して、もう一度比べてみよう！';return;}
    state.method=PLAY_SEQUENCE[playingIndex];state.feedback={kind:'same',text:'同じ容量のまま、計算方法だけを変更しています。'};
    sync();
  },1450);
});
$('restoreManualQuick').addEventListener('click',()=>{$('restoreManual').click();$('playStatus').hidden=true;});
initInverseExplanation();
render();
