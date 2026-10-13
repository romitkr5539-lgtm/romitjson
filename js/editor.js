const documentInput=document.querySelector("#jsonDocument");
const statusPanel=document.querySelector("#editorStatus");
const statusMark=document.querySelector("#statusMark");
const statusText=document.querySelector("#statusText");
const formatButton=document.querySelector("#formatBtn");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");

function setStatus(text,type=""){
  statusText.textContent=text;
  statusPanel.className="editor-status"+(type?" "+type:"");
  statusMark.textContent=type==="valid"?"✓":type==="invalid"?"!":"•";
}

function updateLineCount(){
  const lines=documentInput.value?documentInput.value.split("\n").length:0;
  document.querySelector("#lineCount").textContent=lines.toLocaleString()+(lines===1?" line":" lines");
}

function inspectDocument(){
  updateLineCount();
  const source=documentInput.value.trim();
  if(!source){
    formatButton.disabled=true;
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setStatus("Ready. Your changes stay in this browser.");
    return null;
  }
  try{
    const value=JSON.parse(source);
    formatButton.disabled=false;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    setStatus("Valid JSON. Ready to format or export.","valid");
    return {value};
  }catch(error){
    formatButton.disabled=true;
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setStatus("Invalid JSON: "+error.message,"invalid");
    return null;
  }
}

documentInput.addEventListener("input",inspectDocument);
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