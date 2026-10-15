const input=document.querySelector("#jsonInput");
const output=document.querySelector("#yamlOutput");
const status=document.querySelector("#yamlStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const stats=document.querySelector("#yamlStats");
let YAMLLib=null;
const yamlModulePromise=import("https://cdn.jsdelivr.net/npm/yaml@2.9.1/browser/index.js").then((module)=>{
  YAMLLib=module.default ?? module;
}).catch((error)=>{
  console.error("Failed to load YAML library:",error);
  YAMLLib=null;
});
let yamlText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status yaml-status"+(type?" "+type:"");
}

function deepEqual(left,right){
  if(Object.is(left,right))return true;
  if(left===null||right===null||typeof left!=="object"||typeof right!=="object")return false;
  if(Array.isArray(left)!==Array.isArray(right))return false;
  if(Array.isArray(left)&&Array.isArray(right)){
    if(left.length!==right.length)return false;
    return left.every((item,index)=>deepEqual(item,right[index]));
  }
  const leftKeys=Object.keys(left);
  const rightKeys=Object.keys(right);
  if(leftKeys.length!==rightKeys.length)return false;
  return leftKeys.every(key=>Object.prototype.hasOwnProperty.call(right,key)&&deepEqual(left[key],right[key]));
}

function hasUnsafeInteger(value){
  if(typeof value==="number"){
    return Number.isInteger(value)&&!Number.isSafeInteger(value);
  }
  if(Array.isArray(value)){
    return value.some(hasUnsafeInteger);
  }
  if(value&&typeof value==="object"){
    return Object.values(value).some(hasUnsafeInteger);
  }
  return false;
}

async function serializeYaml(value){
  await yamlModulePromise;
  if(!YAMLLib){
    throw new Error("YAML library failed to load. Please refresh the page and try again.");
  }

  const yamlString=YAMLLib.stringify(value,{
    indent:2,
    lineWidth:0,
    singleQuote:false,
    doubleQuotedAsJSON:true,
    sortMapEntries:false,
    blockQuote:"literal"
  });

  const parsed=YAMLLib.parse(yamlString);
  if(!deepEqual(parsed,value)){
    throw new Error("The generated YAML did not round-trip back into the same JSON structure.");
  }

  return yamlString;
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

async function convert(){
  const source=input.value;
  inputSize.textContent=source.length.toLocaleString()+" characters";
  if(!source.trim()){
    resetOutput();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const value=JSON.parse(source);
    const hasUnsafeNumbers=hasUnsafeInteger(value);
    yamlText=await serializeYaml(value);
    output.textContent=yamlText;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#yamlSize").textContent=byteCount(yamlText).toLocaleString()+" bytes";
    stats.hidden=false;
    if(hasUnsafeNumbers){
      setStatus("Valid JSON. Converted to YAML, but some integers exceed JavaScript's safe range and may lose precision in the browser.","success");
    }else{
      setStatus("Valid JSON. Converted to YAML and verified by a YAML round-trip.","success");
    }
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
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    resetOutput();
    setStatus("Please choose a JSON file.","error");
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