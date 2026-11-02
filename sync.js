(()=>{"use strict";
const $=id=>document.getElementById(id);
const audio=$("audio"),key="vale-karaoke-sync-algo-novo-v1";
let lines=[],cursor=0,edited=-1,fileUrl=null,refreshHandle=0;
const timefmt=t=>{if(t==null||!Number.isFinite(t))return "—";let m=Math.floor(Math.max(0,t)/60),s=Math.max(0,t)-m*60;return String(m).padStart(2,"0")+":"+s.toFixed(2).padStart(5,"0")};
function store(){try{localStorage.setItem(key,JSON.stringify(lines));}catch{}}
function pickCursor(){const index=lines.findIndex(x=>x.time===null);cursor=index<0?lines.length:index}
function draw(){
 const marked=lines.filter(x=>x.time!==null).length;
 $("progress").textContent=marked+"/"+lines.length+" marcadas";
 $("nextIndex").textContent=cursor<lines.length?"Frase "+(cursor+1)+" de "+lines.length:"Todas as frases têm horários";
 $("nextLine").textContent=cursor<lines.length?lines[cursor].text:"Sincronização concluída! Exporte o arquivo LRC.";
 $("mark").disabled=cursor>=lines.length||!audio.src;
 const list=$("list");list.replaceChildren();
 lines.forEach((item,i)=>{
  const btn=document.createElement("button");btn.type="button";
  btn.className="lyric-row"+(i===cursor?" active":"")+(item.time!==null?" done":"");
  const number=document.createElement("span");number.className="line-num";number.textContent=String(i+1).padStart(2,"0");
  const phrase=document.createElement("span");phrase.className="lyric-text";phrase.textContent=item.text;
  const time=document.createElement("span");time.className="line-time";time.textContent=timefmt(item.time);
  btn.append(number,phrase,time);
  btn.onclick=()=>openEdit(i);
  list.append(btn);
 });
 const badOrder=lines.some((x,i)=>i>0&&x.time!==null&&lines[i-1].time!==null&&x.time<lines[i-1].time);
 $("warnings").textContent=badOrder?"Atenção: existe horário fora de ordem. Revise antes de exportar.":marked<lines.length?"Restam "+(lines.length-marked)+" frases sem marcação.":"Tudo marcado. Confira a sincronia antes de publicar.";
}
function setLines(text,preserve=false){
 const arr=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const previous=lines;
 lines=arr.map((t,i)=>({text:t,time:preserve&&previous[i]&&previous[i].text===t?previous[i].time:null}));
 pickCursor();store();draw();
}
function mark(){
 if(cursor>=lines.length||!audio.src)return;
 lines[cursor].time=Math.round(audio.currentTime*100)/100;
 store();pickCursor();draw();
 const active=$("list").querySelector(".active");if(active)active.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function seek(delta){if(!audio.src)return;audio.currentTime=Math.max(0,Math.min(audio.duration||Infinity,audio.currentTime+delta));updateTime()}
function adjust(delta){let i=Math.min(lines.length-1,cursor-1);while(i>=0&&lines[i].time===null)i--;if(i>=0){lines[i].time=Math.max(0,Math.round((lines[i].time+delta)*100)/100);store();draw();}}
function updateTime(){
 $("clock").textContent=timefmt(audio.currentTime||0);
 $("total").textContent=timefmt(Number.isFinite(audio.duration)?audio.duration:0);
 if(Number.isFinite(audio.duration)&&audio.duration>0)$("scrub").value=Math.round(1000*audio.currentTime/audio.duration);
 $("play").textContent=audio.paused?"▶ Reproduzir":"Ⅱ Pausar";
}
function openEdit(i){edited=i;$("editTitle").textContent=lines[i].text;$("lineTime").value=lines[i].time??"";$("editModal").showModal()}
function closeEdit(){$("editModal").close();edited=-1}
function download(){
 const marked=lines.filter(x=>x.time!==null);
 if(!marked.length){alert("Marque ao menos uma frase antes de exportar.");return;}
 if(marked.length<lines.length&&!confirm("Ainda há frases sem tempo. Exportar somente as "+marked.length+" frases marcadas?"))return;
 const sorted=[...marked].sort((a,b)=>a.time-b.time);
 const header="[ti:Algo Novo]\n[ar:Kemuel (part. Lukas Agustinho)]\n[by:VALE KARAOKE · sincronização manual]\n";
 const content=header+sorted.map(x=>"["+timefmt(x.time)+"]"+x.text).join("\n")+"\n";
 const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="letra.lrc";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function startup(){
 try{
  const response=await fetch("songs/algo-novo-kemuel/letra-base.txt",{cache:"no-store"});
  if(!response.ok)throw new Error();
  const text=await response.text();
  let restored=null;try{restored=JSON.parse(localStorage.getItem(key)||"null")}catch{}
  if(Array.isArray(restored)&&restored.length&&restored.every(x=>x&&typeof x.text==="string"&&(x.time===null||Number.isFinite(x.time)))){
   lines=restored;
  }else lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(text=>({text,time:null}));
  $("lyricsText").value=lines.map(x=>x.text).join("\n");
  pickCursor();draw();
 }catch{$("nextLine").textContent="Não foi possível carregar a letra. Sirva os arquivos por GitHub Pages.";}
}
$("audioFile").addEventListener("change",ev=>{const f=ev.target.files[0];if(!f)return;if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl=URL.createObjectURL(f);audio.src=fileUrl;audio.load();updateTime();draw();});
$("applyText").onclick=()=>{if(confirm("Aplicar alterações? A marcação das frases que não mudaram será preservada.")){setLines($("lyricsText").value,true);}};
$("play").onclick=async()=>{if(!audio.src){alert("Selecione o arquivo do playback para começar.");return;}if(audio.paused){try{await audio.play();}catch{alert("O navegador não conseguiu reproduzir este arquivo.");}}else audio.pause();updateTime()};
$("back").onclick=()=>seek(-5);$("forward").onclick=()=>seek(5);
$("scrub").addEventListener("input",ev=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(ev.target.value)*audio.duration/1000;updateTime()});
$("speed").onchange=()=>{audio.playbackRate=Number($("speed").value)};
$("mark").onclick=mark;
$("skip").onclick=()=>{if(cursor<lines.length){lines.splice(cursor,1);$("lyricsText").value=lines.map(x=>x.text).join("\n");store();pickCursor();draw();}};
$("undo").onclick=()=>{const i=lines.map(x=>x.time).lastIndexOf(lines.filter(x=>x.time!==null).at(-1)?.time);if(i>=0){lines[i].time=null;pickCursor();store();draw();}};
$("minus").onclick=()=>adjust(-.1);$("plus").onclick=()=>adjust(.1);
$("saveDraft").onclick=()=>{store();alert("Rascunho salvo neste navegador.");};
$("download").onclick=download;
$("closeModal").onclick=closeEdit;
$("editForm").addEventListener("submit",ev=>{ev.preventDefault();if(edited<0)return;const num=Number($("lineTime").value);if(!Number.isFinite(num)||num<0){alert("Informe um número de segundos válido.");return;}lines[edited].time=Math.round(num*100)/100;store();pickCursor();draw();closeEdit()});
$("setCurrent").onclick=()=>{if(edited<0)return;lines[edited].time=Math.round(audio.currentTime*100)/100;store();pickCursor();draw();closeEdit()};
$("removeTime").onclick=()=>{if(edited<0)return;lines[edited].time=null;store();pickCursor();draw();closeEdit()};
audio.addEventListener("timeupdate",updateTime);audio.addEventListener("loadedmetadata",updateTime);audio.addEventListener("play",updateTime);audio.addEventListener("pause",updateTime);
document.addEventListener("keydown",ev=>{if($("editModal").open)return;if(["TEXTAREA","INPUT","SELECT"].includes(document.activeElement?.tagName))return;if(ev.code==="Space"){ev.preventDefault();mark()}if(ev.code==="ArrowLeft")seek(-3);if(ev.code==="ArrowRight")seek(3)});
window.addEventListener("beforeunload",()=>{store();if(fileUrl)URL.revokeObjectURL(fileUrl)});
startup();
})();