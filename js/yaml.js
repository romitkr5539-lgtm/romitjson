const input=document.querySelector("#jsonInput");
const output=document.querySelector("#yamlOutput");
const status=document.querySelector("#yamlStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const stats=document.querySelector("#yamlStats");
let yamlText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status yaml-status"+(type?" "+type:"");
}

function yamlString(value){
  const ambiguous=/^(?:~|null|true|false|yes|no|on|off|y|n|\.inf|[-+]?\.nan)$/i.test(value);
  const numberLike=/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?\d[\d_]*)?$/.test(value)||/^0[xob][0-9a-f_]+$/i.test(value);
  const dateLike=/^\d{4}-\d{2}-\d{2}(?:$|[Tt ])/i.test(value);
  const needsQuotes=value===""||value.trim()!==value||ambiguous||numberLike||dateLike||/[:#\[\]{},&*!|>'"%@`\n\r\t]/.test(value)||/^[-?]\s/.test(value)||/\s#/.test(value);
  return needsQuotes?JSON.stringify(value):value;
}

function yamlKey(key){
  return yamlString(key);
}

function isCollection(value){
  return value!==null&&typeof value==="object";
}

function yamlValue(value,indent=0){
  const pad=" ".repeat(indent);
  if(value===null)return pad+"null";
  if(typeof value==="string")return pad+yamlString(value);
  if(typeof value!=="object")return pad+String(value);
  if(Array.isArray(value)){
    if(value.length===0)return pad+"[]";
    return value.map(item=>{
      if(isCollection(item)&&(Array.isArray(item)?item.length>0:Object.keys(item).length>0))return pad+"-\n"+yamlValue(item,indent+2);
      return pad+"- "+yamlValue(item,indent+2).trimStart();
    }).join("\n");
  }
  const entries=Object.entries(value);
  if(entries.length===0)return pad+"{}";
  return entries.map(([key,item])=>{
    const prefix=pad+yamlKey(key)+":";
    if(isCollection(item)&&(Array.isArray(item)?item.length>0:Object.keys(item).length>0))return prefix+"\n"+yamlValue(item,indent+2);
    return prefix+" "+yamlValue(item,indent+2).trimStart();
  }).join("\n");
}

function rootType(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function resetOutput(){
  yamlText="";
  output.textContent="";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
}

function convert(){
  const source=input.value;
  inputSize.textContent=source.length.toLocaleString()+" characters";
  if(!source.trim()){
    resetOutput();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const value=JSON.parse(source);
    yamlText=yamlValue(value);
    output.textContent=yamlText;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#yamlSize").textContent=byteCount(yamlText).toLocaleString()+" bytes";
    stats.hidden=false;
    setStatus("Valid JSON. Converted to YAML.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    resetOutput();
    setStatus("Invalid JSON: "+error.message,"error");
  }
}

document.querySelector("#convertBtn").addEventListener("click",convert);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  inputSize.textContent="0 characters";
  resetOutput();
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","validate",{name:"YAML",enabled:true}],private:true},null,2);
  convert();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    resetOutput();
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    convert();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
input.addEventListener("input",()=>{
  inputSize.textContent=input.value.length.toLocaleString()+" characters";
  resetOutput();
  setStatus(input.value.trim()?"Input changed. Convert again to update the YAML.":"Paste JSON or open a file to begin.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")convert();
});
copyButton.addEventListener("click",async()=>{
  if(!yamlText)return;
  try{
    await navigator.clipboard.writeText(yamlText);
    setStatus("YAML copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  const blob=new Blob([yamlText],{type:"text/yaml;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="converted.yaml";
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