const input=document.querySelector("#jsonInput");
const output=document.querySelector("#xmlOutput");
const status=document.querySelector("#xmlStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyButton");
const downloadButton=document.querySelector("#downloadButton");
const stats=document.querySelector("#xmlStats");
const rootNameInput=document.querySelector("#rootName");
const fileName=document.querySelector("#inputFileName");
const indentWidthSelect=document.querySelector("#indentWidth");
const prettyPrintCheckbox=document.querySelector("#prettyPrint");
const declarationCheckbox=document.querySelector("#xmlDeclaration");
const RAW_NUMBER=Symbol("rawJsonNumber");
let xmlText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status xml-status"+(type?" "+type:"");
}

function validateXmlName(value){
  const name=String(value);
  if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)||/^xml/i.test(name)){
    throw new Error("Root element must start with a letter or underscore and contain only letters, numbers, dots, hyphens or underscores; names beginning with XML are reserved.");
  }
  return name;
}

function escapeXml(value,attribute=false){
  const text=String(value);
  for(const character of text){
    const codePoint=character.codePointAt(0);
    const valid=codePoint===0x9||codePoint===0xA||codePoint===0xD||(codePoint>=0x20&&codePoint<=0xD7FF)||(codePoint>=0xE000&&codePoint<=0xFFFD)||(codePoint>=0x10000&&codePoint<=0x10FFFF);
    if(!valid)throw new Error("XML 1.0 does not allow character U+"+codePoint.toString(16).toUpperCase().padStart(4,"0")+".");
  }
  let escaped=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;").replace(/\r/g,"&#xD;");
  if(attribute)escaped=escaped.replace(/\t/g,"&#x9;").replace(/\n/g,"&#xA;");
  return escaped;
}

function isRawNumber(value){
  return value!==null&&typeof value==="object"&&Object.prototype.hasOwnProperty.call(value,RAW_NUMBER);
}

function hasUnsafeNumberToken(source){
  let visible="";
  let inString=false;
  let escaped=false;
  for(const character of source){
    if(inString){
      visible+=" ";
      if(escaped)escaped=false;
      else if(character==="\\")escaped=true;
      else if(character==='"')inString=false;
    }else if(character==='"'){
      inString=true;
      visible+=" ";
    }else{
      visible+=character;
    }
  }
  const tokens=visible.match(/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/g)||[];
  return tokens.some(token=>{
    const number=Number(token);
    return !Number.isFinite(number)||(Number.isInteger(number)&&!Number.isSafeInteger(number));
  });
}

function parseJsonPreservingNumbers(source){
  let sawSource=false;
  const value=JSON.parse(source,(key,item,context)=>{
    if(typeof item==="number"&&context&&typeof context.source==="string"){
      sawSource=true;
      return {[RAW_NUMBER]:context.source};
    }
    return item;
  });
  if(!sawSource&&hasUnsafeNumberToken(source)){
    throw new Error("This browser cannot preserve a number outside its precise range. Use a current browser or quote the value as a JSON string.");
  }
  return value;
}

function xmlType(value){
  if(isRawNumber(value))return"number";
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function xmlValue(value,tag,depth,settings,propertyName){
  const indent=settings.pretty?" ".repeat(depth*settings.indentWidth):"";
  const type=xmlType(value);
  const nameAttribute=propertyName===null?"":" name=\""+escapeXml(propertyName,true)+"\"";
  const opening="<"+tag+nameAttribute+" type=\""+type+"\"";
  if(type==="null")return indent+opening+"/>";
  if(type==="object"||type==="array"){
    const entries=type==="object"?Object.entries(value).map(([key,item])=>["property",key,item]):value.map(item=>["item",null,item]);
    if(entries.length===0)return indent+opening+"/>";
    const children=entries.map(([childTag,key,item])=>xmlValue(item,childTag,depth+1,settings,key)).join(settings.pretty?"\n":"");
    return indent+opening+">"+(settings.pretty?"\n":"")+children+(settings.pretty?"\n"+indent:"")+"</"+tag+">";
  }
  const text=type==="number"&&isRawNumber(value)?value[RAW_NUMBER]:String(value);
  return indent+opening+">"+escapeXml(text)+"</"+tag+">";
}

function validateXmlDocument(text,expectedRoot){
  if(typeof DOMParser==="undefined")throw new Error("XML parsing is unavailable in this browser.");
  const parsed=new DOMParser().parseFromString(text,"application/xml");
  const root=parsed.documentElement;
  const parserError=root&&root.namespaceURI&&root.namespaceURI.toLowerCase().includes("parsererror");
  if(!root||root.nodeName!==expectedRoot||parserError){
    throw new Error("Generated XML failed XML 1.0 parsing.");
  }
}

function rootType(value){
  if(isRawNumber(value))return"number";
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
    const value=parseJsonPreservingNumbers(source);
    const root=validateXmlName(rootNameInput.value.trim()||"root");
    const settings={
      pretty:prettyPrintCheckbox.checked,
      indentWidth:Number(indentWidthSelect.value)===4?4:2
    };
    const body=xmlValue(value,root,0,settings,null);
    const declaration=declarationCheckbox.checked?'<?xml version="1.0" encoding="UTF-8"?>'+(settings.pretty?"\n":""):"";
    const generated=declaration+body;
    validateXmlDocument(generated,root);
    xmlText=generated;
    output.textContent=xmlText;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#xmlSize").textContent=byteCount(xmlText).toLocaleString()+" bytes";
    stats.hidden=false;
    setStatus("Valid JSON. XML parsed successfully with typed values.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    resetOutput();
    setStatus(error instanceof SyntaxError?"Invalid JSON: "+error.message:error.message,"error");
  }
}

function loadJsonFile(file){
  if(file.size>50*1024*1024){
    resetOutput();
    fileName.textContent="";
    setStatus("File exceeds the 50 MiB limit.","error");
    fileInput.value="";
    return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    resetOutput();
    fileName.textContent="";
    setStatus("Please choose a JSON file.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    fileName.textContent=file.name;
    convert();
  };
  reader.onerror=()=>{
    resetOutput();
    fileName.textContent="";
    setStatus("Could not read this file.","error");
  };
  reader.readAsText(file);
}

document.querySelector("#convertBtn").addEventListener("click",convert);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  inputSize.textContent="0 characters";
  fileName.textContent="";
  fileInput.value="";
  resetOutput();
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",active:true,profile:{city:"Patna"},skills:["HTML","CSS"]},null,2);
  fileName.textContent="";
  convert();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
document.querySelector("#pasteBtn").addEventListener("click",async()=>{
  try{
    const text=await navigator.clipboard.readText();
    input.value=text;
    fileName.textContent="";
    convert();
  }catch{
    setStatus("Clipboard access is unavailable. Paste JSON into the input manually.","error");
  }
});
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(file)loadJsonFile(file);
});
for(const control of [indentWidthSelect,prettyPrintCheckbox,declarationCheckbox]){
  control.addEventListener("change",()=>{
    if(input.value.trim())convert();
    else setStatus("Output options updated. Paste or load JSON to convert.");
  });
}
input.addEventListener("input",()=>{
  inputSize.textContent=input.value.length.toLocaleString()+" characters";
  fileName.textContent="";
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const inputPanel=document.querySelector(".xml-input-panel");
inputPanel.addEventListener("dragover",event=>{
  event.preventDefault();
  inputPanel.classList.add("is-dragging");
});
inputPanel.addEventListener("dragleave",event=>{
  if(!inputPanel.contains(event.relatedTarget))inputPanel.classList.remove("is-dragging");
});
inputPanel.addEventListener("drop",event=>{
  event.preventDefault();
  inputPanel.classList.remove("is-dragging");
  const file=event.dataTransfer.files[0];
  if(file)loadJsonFile(file);
  else setStatus("Drop a JSON file to load it.","error");
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