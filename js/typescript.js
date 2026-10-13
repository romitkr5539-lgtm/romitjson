const input=document.querySelector("#jsonInput");
const output=document.querySelector("#typescriptOutput");
const status=document.querySelector("#typescriptStatus");
const typeNameInput=document.querySelector("#typeName");
const declarationStyle=document.querySelector("#declarationStyle");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyButton");
const downloadButton=document.querySelector("#downloadButton");
const stats=document.querySelector("#typescriptStats");
const rootTypeText=document.querySelector("#rootType");
const declarationCountText=document.querySelector("#declarationCount");
const outputSizeText=document.querySelector("#outputSize");

const sample={
  profile:{
    id:101,
    name:"RomitJSON",
    roles:["formatter","validator","converter"],
    active:true,
    metadata:{owner:"team",version:"1.0.0"}
  },
  features:[{name:"JSON",enabled:true},{name:"TypeScript",enabled:true}],
  tags:["browser","local"]
};

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status"+(type?" "+type:"");
}

function sanitizeTypeName(value){
  const name=(value||"Root").trim()||"Root";
  const normalized=name.replace(/[^A-Za-z0-9_$]+/g," ").trim();
  if(!normalized)return"Root";
  const parts=normalized.split(/\s+/).filter(Boolean);
  const base=parts.map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join("");
  return base||"Root";
}

function pascalCase(value){
  const text=String(value||"Item").trim();
  if(!text)return"Item";
  const clean=text.replace(/[^A-Za-z0-9_$]+/g," ").trim();
  if(!clean)return"Item";
  const parts=clean.split(/\s+/).filter(Boolean);
  const name=parts.map((part,index)=>index===0?part.charAt(0).toUpperCase()+part.slice(1):part.charAt(0).toUpperCase()+part.slice(1)).join("");
  return name||"Item";
}

function propertyKey(key){
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)?key:"["+JSON.stringify(key)+"]";
}

function rootTypeName(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  if(typeof value==="object")return"object";
  return typeof value;
}

function primitiveType(value){
  if(value===null)return"null";
  if(typeof value==="string")return"string";
  if(typeof value==="number")return"number";
  if(typeof value==="boolean")return"boolean";
  if(Array.isArray(value))return"unknown[]";
  if(typeof value==="object")return"Record<string, unknown>";
  return"unknown";
}

function buildTypeScript(value,rootName){
  const declarations=[];
  const seen=new Set();
  const kind=declarationStyle.value === "type" ? "type" : "interface";

  function emitObject(name,obj){
    const body=Object.entries(obj)
      .map(([key,child])=>{
        const property=propertyKey(key);
        const childType=inferType(child,key);
        return "  "+property+": "+childType+";";
      })
      .join("\n");

    if(kind==="type"){
      declarations.push("type "+name+" = {\n"+(body||"  // empty object")+"\n};");
    }else{
      declarations.push("interface "+name+" {\n"+(body||"")+"\n}");
    }
  }

  function inferType(raw,name){
    if(raw===null)return"null";
    if(typeof raw==="string")return"string";
    if(typeof raw==="number")return"number";
    if(typeof raw==="boolean")return"boolean";
    if(Array.isArray(raw)){
      if(raw.length===0)return"unknown[]";
      const itemTypes=[...new Set(raw.map(item=>inferType(item,name)))];
      if(itemTypes.length===1){
        return itemTypes[0]+"[]";
      }
      return itemTypes.length?"("+itemTypes.join(" | ")+")[]":"unknown[]";
    }
    if(typeof raw==="object"){
      const objectName=pascalCase(name||"Item");
      if(!seen.has(objectName)){
        seen.add(objectName);
        emitObject(objectName,raw);
      }
      return objectName;
    }
    return"unknown";
  }

  if(value===null){
    return "type "+rootName+" = null;";
  }

  if(Array.isArray(value)){
    const itemTypes=[...new Set(value.map(item=>inferType(item,rootName)))];
    const typeExpression=itemTypes.length===1?itemTypes[0]:itemTypes.length?"("+itemTypes.join(" | ")+")":"unknown";
    return "type "+rootName+" = "+typeExpression+"[];";
  }

  if(typeof value === "object"){
    emitObject(rootName,value);
    return declarations.join("\n\n");
  }

  return "type "+rootName+" = "+primitiveType(value)+";";
}

function updateStats(content,parsedValue){
  const declarationMatches=(content.match(/\b(?:interface|type)\s+[A-Za-z0-9_$]+/g)||[]).length;
  const size = byteCount(content);
  stats.hidden=false;
  rootTypeText.textContent=rootTypeName(parsedValue);
  declarationCountText.textContent=String(declarationMatches);
  outputSizeText.textContent=size.toLocaleString()+" bytes";
}

function generate(){
  const source=input.value.trim();
  if(!source){
    output.textContent="Generated TypeScript appears here.";
    copyButton.disabled=true;
    downloadButton.disabled=true;
    stats.hidden=true;
    setStatus("Paste JSON or open a file to begin.");
    return;
  }

  try{
    const parsed=JSON.parse(source);
    const rootName=sanitizeTypeName(typeNameInput.value);
    const typeScript=buildTypeScript(parsed, rootName);
    output.textContent=typeScript;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    updateStats(typeScript, parsed);
    setStatus("TypeScript generated successfully.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    output.textContent="";
    copyButton.disabled=true;
    downloadButton.disabled=true;
    stats.hidden=true;
    setStatus("Invalid JSON: "+error.message,"error");
  }
}

document.querySelector("#generateBtn").addEventListener("click",generate);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  typeNameInput.value="Root";
  output.textContent="Generated TypeScript appears here.";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify(sample,null,2);
  generate();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    generate();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
copyButton.addEventListener("click",async()=>{
  const text=output.textContent.trim();
  if(!text)return;
  try{
    await navigator.clipboard.writeText(text);
    setStatus("TypeScript copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  const text=output.textContent;
  if(!text)return;
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="types.ts";
  link.click();
  URL.revokeObjectURL(url);
});
input.addEventListener("input",()=>{
  if(!input.value.trim()){
    output.textContent="Generated TypeScript appears here.";
    copyButton.disabled=true;
    downloadButton.disabled=true;
    stats.hidden=true;
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  output.textContent="Generated TypeScript appears here.";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
  setStatus("Input changed. Generate again to update the TypeScript.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")generate();
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
