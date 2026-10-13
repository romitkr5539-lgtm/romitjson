const input=document.querySelector("#jsonInput");
const output=document.querySelector("#jsonOutput");
const status=document.querySelector("#minifierStatus");
const inputSize=document.querySelector("#inputSize");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");
const stats=document.querySelector("#minifierStats");
let minifiedText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function formatBytes(bytes){
  return bytes.toLocaleString()+" bytes";
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status minifier-status"+(type?" "+type:"");
}

function clearResult(){
  minifiedText="";
  output.textContent="";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
}

function minifyJson(){
  const source=input.value;
  inputSize.textContent=formatBytes(byteCount(source));
  if(!source.trim()){
    clearResult();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    minifiedText=JSON.stringify(JSON.parse(source));
    output.textContent=minifiedText;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    const originalBytes=byteCount(source);
    const minifiedBytes=byteCount(minifiedText);
    const saved=originalBytes?Math.max(0,(originalBytes-minifiedBytes)/originalBytes*100):0;
    document.querySelector("#originalSize").textContent=formatBytes(originalBytes);
    document.querySelector("#minifiedSize").textContent=formatBytes(minifiedBytes);
    document.querySelector("#sizeSaved").textContent=saved.toFixed(1)+"%";
    stats.hidden=false;
    setStatus("Valid JSON. Whitespace removed from the output.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    clearResult();
    setStatus("Invalid JSON: "+error.message,"error");
  }
}

document.querySelector("#minifyBtn").addEventListener("click",minifyJson);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  inputSize.textContent="0 bytes";
  clearResult();
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2);
  minifyJson();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    clearResult();
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    minifyJson();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
input.addEventListener("input",()=>{
  inputSize.textContent=formatBytes(byteCount(input.value));
  clearResult();
  setStatus(input.value.trim()?"Input changed. Minify again to update the result.":"Paste JSON or open a file to begin.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")minifyJson();
});
copyButton.addEventListener("click",async()=>{
  if(!minifiedText)return;
  try{
    await navigator.clipboard.writeText(minifiedText);
    setStatus("Minified JSON copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  if(!minifiedText)return;
  const blob=new Blob([minifiedText],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="minified.json";
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