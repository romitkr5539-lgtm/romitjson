const input=document.querySelector("#jsonInput");
const output=document.querySelector("#xmlOutput");
const status=document.querySelector("#xmlStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyButton");
const downloadButton=document.querySelector("#downloadButton");
const stats=document.querySelector("#xmlStats");
const rootNameInput=document.querySelector("#rootName");
let xmlText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status xml-status"+(type?" "+type:"");
}

function xmlName(value){
  let name=String(value).replace(/[^A-Za-z0-9_.-]/g,"_");
  if(!/^[A-Za-z_]/.test(name))name="_"+name;
  if(!name)name="item";
  if(/^xml/i.test(name))name="_"+name;
  return name;
}

function uniqueXmlName(value,usedNames){
  const base=xmlName(value);
  let name=base;
  let suffix=2;
  while(usedNames.has(name))name=base+"_"+suffix++;
  usedNames.add(name);
  return name;
}

function escapeXmlText(value){
  const text=String(value);
  for(const character of text){
    const codePoint=character.codePointAt(0);
    const valid=codePoint===0x9||codePoint===0xA||codePoint===0xD||(codePoint>=0x20&&codePoint<=0xD7FF)||(codePoint>=0xE000&&codePoint<=0xFFFD)||(codePoint>=0x10000&&codePoint<=0x10FFFF);
    if(!valid)throw new Error("XML 1.0 does not allow character U+"+codePoint.toString(16).toUpperCase().padStart(4,"0")+".");
  }
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function xmlValue(value,name,depth=0){
  const tag=xmlName(name);
  const indent="  ".repeat(depth);
  if(value===null||typeof value!=="object")return indent+"<"+tag+">"+escapeXmlText(value===null?"":value)+"</"+tag+">";
  if(Array.isArray(value)){
    if(value.length===0)return indent+"<"+tag+"/>";
    const children=value.map(item=>xmlValue(item,"item",depth+1)).join("\n");
    return indent+"<"+tag+">\n"+children+"\n"+indent+"</"+tag+">";
  }
  const entries=Object.entries(value);
  if(entries.length===0)return indent+"<"+tag+"/>";
  const usedNames=new Set();
  const children=entries.map(([key,item])=>xmlValue(item,uniqueXmlName(key,usedNames),depth+1)).join("\n");
  return indent+"<"+tag+">\n"+children+"\n"+indent+"</"+tag+">";
}

function rootType(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function resetOutput(){
  xmlText="";
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
    const requestedRoot=rootNameInput.value.trim()||"root";
    const root=xmlName(requestedRoot);
    xmlText='<?xml version="1.0" encoding="UTF-8"?>\n'+xmlValue(value,root);
    output.textContent=xmlText;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#xmlSize").textContent=byteCount(xmlText).toLocaleString()+" bytes";
    stats.hidden=false;
    setStatus(root!==requestedRoot?"Valid JSON. Root element normalized to <"+root+">.":"Valid JSON. Converted to XML.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    resetOutput();
    setStatus(error instanceof SyntaxError?"Invalid JSON: "+error.message:error.message,"error");
  }
}

document.querySelector("#convertBtn").addEventListener("click",convert);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  inputSize.textContent="0 characters";
  rootNameInput.value="root";
  resetOutput();
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",tools:["format","validate",{name:"XML",enabled:true}],active:true},null,2);
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
  setStatus(input.value.trim()?"Input changed. Convert again to update the XML.":"Paste JSON or open a file to begin.");
});
rootNameInput.addEventListener("input",()=>{
  resetOutput();
  setStatus(input.value.trim()?"Root name changed. Convert again to update the XML.":"Choose a root element, then paste JSON or open a file.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")convert();
});
copyButton.addEventListener("click",async()=>{
  if(!xmlText)return;
  try{
    await navigator.clipboard.writeText(xmlText);
    setStatus("XML copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  if(!xmlText)return;
  const blob=new Blob([xmlText],{type:"application/xml;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="converted.xml";
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