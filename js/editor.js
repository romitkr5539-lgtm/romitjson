const documentInput=document.querySelector("#jsonDocument");
const statusPanel=document.querySelector("#editorStatus");
const statusMark=document.querySelector("#statusMark");
const statusText=document.querySelector("#statusText");
const formatButton=document.querySelector("#formatBtn");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");
const editorOverlay=document.querySelector(".editor-text-overlay");
const editorLineNumbers=document.querySelector(".line-number-panel");
const editorTree=document.querySelector("#editorTree");
const editorTextWrap=document.querySelector(".editor-text-wrap");
const undoButton=document.querySelector("#undoBtn");
const redoButton=document.querySelector("#redoBtn");
const undoHistory=[];
const redoHistory=[];
let lastDocument=documentInput.value;
let editorMode="code";

function updateLineNumbers(){
  const lines=Math.max(1,(documentInput.value||"").split("\n").length);
  if(!editorLineNumbers)return;
  editorLineNumbers.innerHTML=Array.from({length:lines},(_,index)=>`<span>${index+1}</span>`).join("");
}

function parseJsonError(error){
  const message=error&&error.message?error.message:"";
  const positionMatch=/at position\s+(\d+)/i.exec(message);
  const lineMatch=/line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if(lineMatch){
    return {message,line:Number(lineMatch[1]),column:Number(lineMatch[2]),position:positionMatch?Number(positionMatch[1]):null};
  }
  const columnMatch=/column\s+(\d+)/i.exec(message);
  if(columnMatch){
    return {message,line:null,column:Number(columnMatch[1]),position:positionMatch?Number(positionMatch[1]):null};
  }
  return {message,line:null,column:null,position:positionMatch?Number(positionMatch[1]):null};
}

function setTextHighlight(source,error){
  const overlay=document.querySelector(".editor-text-overlay");
  if(!overlay)return;
  overlay.replaceChildren();
  if(!source||!error){
    documentInput.classList.remove("invalid");
    return;
  }
  const details=parseJsonError(error);
  const position=details.position!==null?Math.max(0,Math.min(source.length,details.position)):source.length;
  const start=Math.max(0,position-1);
  const end=Math.min(source.length,position+1);
  const beforeText=source.slice(0,start);
  const badText=source.slice(start,end);
  const afterText=source.slice(end);
  const before=document.createTextNode(beforeText);
  const dirty=document.createTextNode(badText);
  const invalidHighlight=document.createElement("span");
  invalidHighlight.className="invalid-highlight";
  invalidHighlight.appendChild(dirty);
  const fragment=document.createDocumentFragment();
  fragment.append(before,invalidHighlight,document.createTextNode(afterText));
  overlay.appendChild(fragment);
  documentInput.classList.add("invalid");
}

function clearTextHighlight(){
  const overlay=document.querySelector(".editor-text-overlay");
  if(overlay)overlay.replaceChildren();
  documentInput.classList.remove("invalid");
}

function setStatus(text,type=""){
  statusText.textContent=text;
  statusPanel.className="editor-status"+(type?" "+type:"");
  statusMark.textContent=type==="valid"?"✓":type==="invalid"?"!":"•";
}

function updateLineCount(){
  const lines=documentInput.value?documentInput.value.split("\n").length:0;
  document.querySelector("#lineCount").textContent=lines.toLocaleString()+(lines===1?" line":" lines");
}

function syncEditorScroll(){
  editorOverlay.scrollTop=documentInput.scrollTop;
  editorLineNumbers.scrollTop=documentInput.scrollTop;
}

function inspectDocument(){
  updateLineCount();
  updateLineNumbers();
  const source=documentInput.value;
  if(!source.trim()){
    formatButton.disabled=true;
    copyButton.disabled=true;
    downloadButton.disabled=true;
    clearTextHighlight();
    setStatus("Ready. Your changes stay in this browser.");
    if(editorMode==="tree")editorTree.textContent="No JSON to display.";
    return null;
  }
  try{
    const value=JSON.parse(source);
    formatButton.disabled=false;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    clearTextHighlight();
    setStatus("Valid JSON. Ready to format or export.","valid");
    if(editorMode==="tree")renderTree(value);
    return {value};
  }catch(error){
    const details=parseJsonError(error);
    formatButton.disabled=true;
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setTextHighlight(source,error);
    setStatus(`Invalid JSON at column ${details.column!==null?details.column:"?"}: ${details.message}`,"invalid");
    if(editorMode==="tree")editorTree.textContent=statusText.textContent;
    return null;
  }
}

function updateHistoryButtons(){
  undoButton.disabled=undoHistory.length===0;
  redoButton.disabled=redoHistory.length===0;
}

function recordDocumentInput(){
  if(documentInput.value!==lastDocument){
    undoHistory.push(lastDocument);
    if(undoHistory.length>100)undoHistory.shift();
    redoHistory.length=0;
    lastDocument=documentInput.value;
  }
  inspectDocument();
  updateHistoryButtons();
}

function setDocumentValue(value){
  if(documentInput.value!==value){
    undoHistory.push(documentInput.value);
    if(undoHistory.length>100)undoHistory.shift();
    redoHistory.length=0;
    documentInput.value=value;
    lastDocument=value;
  }
  inspectDocument();
  updateHistoryButtons();
}

function renderTree(value){
  editorTree.replaceChildren();
  function appendValue(parent,key,item){
    if(item!==null&&typeof item==="object"){
      const details=document.createElement("details");
      const summary=document.createElement("summary");
      const entries=Array.isArray(item)?item.map((value,index)=>[index,value]):Object.entries(item);
      summary.textContent=String(key)+" "+(Array.isArray(item)?"["+entries.length+"]":"{"+entries.length+"}");
      details.append(summary);
      for(const[childKey,childValue]of entries)appendValue(details,String(childKey),childValue);
      parent.append(details);
      return;
    }
    const node=document.createElement("div");
    node.className="editor-tree-node";
    node.textContent=String(key)+": "+JSON.stringify(item);
    parent.append(node);
  }
  const entries=value!==null&&typeof value==="object"?(Array.isArray(value)?value.map((item,index)=>[index,item]):Object.entries(value)):null;
  if(entries){
    for(const[key,item]of entries)appendValue(editorTree,String(key),item);
    if(!entries.length){const empty=document.createElement("div");empty.className="editor-tree-empty";empty.textContent=Array.isArray(value)?"Empty array":"Empty object";editorTree.append(empty)}
  }else{
    const node=document.createElement("div");node.className="editor-tree-node";node.textContent=JSON.stringify(value);editorTree.append(node);
  }
}

function indentValue(){
  const value=document.querySelector("#editorIndent").value;
  return value==="tab"?"\t":Number(value);
}

documentInput.addEventListener("input",recordDocumentInput);
documentInput.addEventListener("scroll",syncEditorScroll);
documentInput.addEventListener("keydown",event=>{
  if(event.key==="Tab"){
    event.preventDefault();
    const start=documentInput.selectionStart;
    const end=documentInput.selectionEnd;
    documentInput.setRangeText(indentValue(),start,end,"end");
    recordDocumentInput();
  }else if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){
    inspectDocument();
  }
});
formatButton.addEventListener("click",()=>{
  const parsed=inspectDocument();
  if(parsed===null)return;
  setDocumentValue(JSON.stringify(parsed.value,null,indentValue()));
  documentInput.focus();
});
undoButton.addEventListener("click",()=>{
  if(!undoHistory.length)return;
  redoHistory.push(documentInput.value);
  documentInput.value=undoHistory.pop();
  lastDocument=documentInput.value;
  inspectDocument();
  updateHistoryButtons();
  documentInput.focus();
});
redoButton.addEventListener("click",()=>{
  if(!redoHistory.length)return;
  undoHistory.push(documentInput.value);
  documentInput.value=redoHistory.pop();
  lastDocument=documentInput.value;
  inspectDocument();
  updateHistoryButtons();
  documentInput.focus();
});
document.querySelector("#sortBtn").addEventListener("click",()=>{
  const parsed=inspectDocument();
  if(parsed===null)return;
  function sortKeys(value){
    if(Array.isArray(value))return value.map(sortKeys);
    if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort((a,b)=>a.localeCompare(b)).map(key=>[key,sortKeys(value[key])]));
    return value;
  }
  setDocumentValue(JSON.stringify(sortKeys(parsed.value),null,indentValue()));
  setStatus("Object keys sorted alphabetically.","valid");
});
document.querySelector("#validateBtn").addEventListener("click",()=>{
  const parsed=inspectDocument();
  if(parsed!==null)setStatus("Valid JSON. No syntax errors found.","valid");
  documentInput.focus();
});
document.querySelector("#findBtn").addEventListener("click",()=>{
  if(editorMode!=="code"){
    document.querySelector("#editorView").value="code";
    document.querySelector("#editorView").dispatchEvent(new Event("change"));
  }
  const findbar=document.querySelector("#editorFindbar");
  findbar.hidden=false;
  document.querySelector("#editorFind").focus();
});
function findInDocument(direction){
  const query=document.querySelector("#editorFind").value;
  const findStatus=document.querySelector("#findStatus");
  if(!query){findStatus.textContent="Enter text to search.";return}
  const source=documentInput.value.toLocaleLowerCase();
  const needle=query.toLocaleLowerCase();
  const start=direction>0?documentInput.selectionEnd:documentInput.selectionStart-1;
  let index=direction>0?source.indexOf(needle,Math.max(0,start)):source.lastIndexOf(needle,Math.max(0,start));
  if(index<0)index=direction>0?source.indexOf(needle):source.lastIndexOf(needle);
  if(index<0){findStatus.textContent="No matches.";return}
  documentInput.focus();
  documentInput.setSelectionRange(index,index+query.length);
  findStatus.textContent="Match at character "+(index+1)+".";
}
document.querySelector("#findNext").addEventListener("click",()=>findInDocument(1));
document.querySelector("#findPrevious").addEventListener("click",()=>findInDocument(-1));
document.querySelector("#editorFind").addEventListener("keydown",event=>{
  if(event.key==="Enter"){event.preventDefault();findInDocument(event.shiftKey?-1:1)}
  if(event.key==="Escape")document.querySelector("#closeFind").click();
});
document.querySelector("#closeFind").addEventListener("click",()=>{
  document.querySelector("#editorFindbar").hidden=true;
  document.querySelector("#findStatus").textContent="";
  document.querySelector("#editorFind").value="";
});
document.querySelector("#editorView").addEventListener("change",event=>{
  editorMode=event.target.value;
  const treeMode=editorMode==="tree";
  editorTextWrap.classList.toggle("tree-mode",treeMode);
  editorTree.hidden=!treeMode;
  if(treeMode)inspectDocument();
  else documentInput.focus();
});
document.querySelector("#printBtn").addEventListener("click",()=>window.print());
document.querySelector("#fullscreenBtn").addEventListener("click",async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await document.querySelector(".editor-tool").requestFullscreen();
  }catch(error){setStatus("Fullscreen is unavailable in this browser.","invalid")}
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  setDocumentValue("");
  document.querySelector("#fileName").textContent="Untitled JSON";
  documentInput.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  document.querySelector("#fileName").textContent="Sample JSON";
  setDocumentValue(JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2));
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    setStatus("File exceeds the 10MB limit.","invalid");
    fileInput.value="";
    return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    setStatus("Please choose a JSON file.","invalid");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    document.querySelector("#fileName").textContent=file.name;
    setDocumentValue(String(reader.result||""));
  };
  reader.onerror=()=>setStatus("Could not read this file.","invalid");
  reader.readAsText(file);
});
copyButton.addEventListener("click",async()=>{
  if(inspectDocument()===null)return;
  try{
    await navigator.clipboard.writeText(documentInput.value);
    setStatus("JSON copied to clipboard.","valid");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","invalid");
  }
});
downloadButton.addEventListener("click",()=>{
  if(inspectDocument()===null)return;
  const blob=new Blob([documentInput.value],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="edited.json";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

const mainNav=document.querySelector("#mainNav");
const menuButton=document.querySelector("#menuBtn");
menuButton.addEventListener("click",()=>{
  const isOpen=mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded",String(isOpen));
});
document.querySelectorAll(".nav-drop-btn").forEach(button=>button.addEventListener("click",event=>{
  event.stopPropagation();
  const dropdown=button.parentElement;
  document.querySelectorAll(".nav-dropdown").forEach(item=>{
    if(item!==dropdown){
      item.classList.remove("open");
      item.querySelector(".nav-drop-btn").setAttribute("aria-expanded","false");
    }
  });
  const isOpen=dropdown.classList.toggle("open");
  button.setAttribute("aria-expanded",String(isOpen));
}));
document.addEventListener("click",event=>{
  if(!event.target.closest(".nav-dropdown")){
    document.querySelectorAll(".nav-dropdown").forEach(item=>{
      item.classList.remove("open");
      item.querySelector(".nav-drop-btn").setAttribute("aria-expanded","false");
    });
  }
});
document.querySelectorAll("#mainNav a").forEach(link=>link.addEventListener("click",()=>{
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
}));
document.querySelector("#year").textContent=new Date().getFullYear();