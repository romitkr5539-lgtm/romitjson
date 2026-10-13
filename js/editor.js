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
    return null;
  }
  try{
    const value=JSON.parse(source);
    formatButton.disabled=false;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    clearTextHighlight();
    setStatus("Valid JSON. Ready to format or export.","valid");
    return {value};
  }catch(error){
    const details=parseJsonError(error);
    formatButton.disabled=true;
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setTextHighlight(source,error);
    setStatus(`Invalid JSON at column ${details.column!==null?details.column:"?"}: ${details.message}`,"invalid");
    return null;
  }
}

documentInput.addEventListener("input",inspectDocument);
documentInput.addEventListener("scroll",syncEditorScroll);
documentInput.addEventListener("keydown",event=>{
  if(event.key==="Tab"){
    event.preventDefault();
    const start=documentInput.selectionStart;
    const end=documentInput.selectionEnd;
    documentInput.setRangeText("  ",start,end,"end");
    inspectDocument();
  }else if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){
    inspectDocument();
  }
});
formatButton.addEventListener("click",()=>{
  const parsed=inspectDocument();
  if(parsed===null)return;
  documentInput.value=JSON.stringify(parsed.value,null,2);
  inspectDocument();
  documentInput.focus();
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  documentInput.value="";
  document.querySelector("#fileName").textContent="Untitled JSON";
  inspectDocument();
  documentInput.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  document.querySelector("#fileName").textContent="Sample JSON";
  documentInput.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2);
  inspectDocument();
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
  const reader=new FileReader();
  reader.onload=()=>{
    document.querySelector("#fileName").textContent=file.name;
    documentInput.value=String(reader.result||"");
    inspectDocument();
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
  URL.revokeObjectURL(url);
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