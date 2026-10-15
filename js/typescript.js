const input=document.querySelector("#jsonInput");
const inputSize=document.querySelector("#inputSize");
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
const exportTypesCheckbox=document.querySelector("#exportTypes");
const optionalPropertiesCheckbox=document.querySelector("#optionalProperties");
const emptyFallbackSelect=document.querySelector("#emptyFallback");
const readonlyPropertiesCheckbox=document.querySelector("#readonlyProperties");
const fileName=document.querySelector("#inputFileName");
let generatedText="";

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

const typeScriptKeywords=new Set(("abstract any as asserts async await boolean break case catch class const constructor continue debugger declare " +
  "default delete do else enum export extends false finally for from function get if implements import in infer instanceof " +
  "interface is keyof let module namespace never new null number object package private protected public readonly require " +
  "return set static string super switch symbol this throw true try type typeof undefined unique unknown var void while with yield").split(/\s+/));

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status typescript-status"+(type?" "+type:"");
}

function validateRootName(value){
  const name=String(value||"").trim();
  if(!/^[$A-Z_a-z][$\w]*$/.test(name)||typeScriptKeywords.has(name)){
    throw new Error("Root type name must be a valid TypeScript identifier and cannot be a reserved keyword.");
  }
  return name;
}

function derivedTypeName(value){
  const words=String(value||"Item").match(/[A-Za-z0-9_$]+/g)||[];
  let name=words.map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join("")||"Item";
  if(/^\d/.test(name))name="Type"+name;
  if(typeScriptKeywords.has(name))name+="Type";
  return name;
}

function scalarType(name){
  return {kind:"scalar",name};
}

function objectType(fields=new Map()){
  return {kind:"object",fields};
}

function arrayType(element){
  return {kind:"array",element};
}

function unionTypes(members){
  return members.length===1?members[0]:{kind:"union",members};
}

function mergeTypes(left,right){
  if(left.kind==="scalar"&&left.name==="any"||right.kind==="scalar"&&right.name==="any")return scalarType("any");
  if(left.kind==="scalar"&&left.name==="unknown"||right.kind==="scalar"&&right.name==="unknown")return scalarType("unknown");
  if(left.kind==="object"&&right.kind==="object"){
    const fields=new Map();
    for(const key of new Set([...left.fields.keys(),...right.fields.keys()])){
      const leftField=left.fields.get(key);
      const rightField=right.fields.get(key);
      if(leftField&&rightField){
        fields.set(key,{type:mergeTypes(leftField.type,rightField.type),optional:leftField.optional||rightField.optional});
      }else{
        const field=leftField||rightField;
        fields.set(key,{type:field.type,optional:true});
      }
    }
    return objectType(fields);
  }
  if(left.kind==="array"&&right.kind==="array"){
    return arrayType(mergeTypes(left.element,right.element));
  }
  if(left.kind==="scalar"&&right.kind==="scalar"&&left.name===right.name)return left;

  const candidates=[...(left.kind==="union"?left.members:[left]),...(right.kind==="union"?right.members:[right])];
  const members=[];
  for(const candidate of candidates){
    const compatibleIndex=members.findIndex(member=>{
      if(member.kind!==candidate.kind)return false;
      if(member.kind==="scalar")return member.name===candidate.name;
      return member.kind==="object"||member.kind==="array";
    });
    if(compatibleIndex===-1)members.push(candidate);
    else members[compatibleIndex]=mergeTypes(members[compatibleIndex],candidate);
  }
  return unionTypes(members);
}

function inferValue(value,fallback){
  if(value===null)return scalarType("null");
  if(typeof value==="string")return scalarType("string");
  if(typeof value==="number")return scalarType("number");
  if(typeof value==="boolean")return scalarType("boolean");
  if(Array.isArray(value)){
    if(!value.length)return arrayType(scalarType(fallback));
    return arrayType(value.map(item=>inferValue(item,fallback)).reduce(mergeTypes));
  }
  const fields=new Map();
  for(const [key,child] of Object.entries(value))fields.set(key,{type:inferValue(child,fallback),optional:false});
  return objectType(fields);
}

function propertyKey(key){
  return /^[$A-Z_a-z][$\w]*$/.test(key)?key:JSON.stringify(key);
}

function buildTypeScript(value,rootName,settings){
  const model=inferValue(value,settings.fallback);
  const declarations=[];
  const allocated=new Set([rootName]);
  const namesByObject=new Map();
  const kind=declarationStyle.value==="type"?"type":"interface";

  function allocateName(hint){
    const base=derivedTypeName(hint);
    let name=base;
    let suffix=2;
    while(allocated.has(name))name=base+suffix++;
    allocated.add(name);
    return name;
  }

  function emitObject(object,name){
    namesByObject.set(object,name);
    const lines=[];
    for(const [key,field] of object.fields){
      const childType=renderType(field.type,derivedTypeName(key));
      const optional=settings.optionalProperties&&field.optional?"?":"";
      const readonly=settings.readonlyProperties?"readonly ":"";
      lines.push("  "+readonly+propertyKey(key)+optional+": "+childType+";");
    }
    const prefix=settings.exportTypes?"export ":"";
    if(kind==="interface")declarations.push(prefix+"interface "+name+" {\n"+lines.join("\n")+"\n}");
    else declarations.push(prefix+"type "+name+" = {\n"+lines.join("\n")+"\n};");
    return name;
  }

  function renderObject(object,hint){
    if(namesByObject.has(object))return namesByObject.get(object);
    const name=object===model?rootName:allocateName(hint);
    return emitObject(object,name);
  }

  function renderType(type,hint="Item"){
    if(type.kind==="scalar")return type.name;
    if(type.kind==="object")return renderObject(type,hint);
    if(type.kind==="array"){
      const element=renderType(type.element,hint+"Item");
      return type.element.kind==="union"?"("+element+")[]":element+"[]";
    }
    return type.members.map(member=>renderType(member,hint+(member.kind==="object"?"Item":""))).join(" | ");
  }

  let rootExpression;
  if(model.kind==="object"){
    renderObject(model,rootName);
    rootExpression=null;
  }else{
    rootExpression=renderType(model,rootName);
  }

  if(rootExpression!==null){
    const prefix=settings.exportTypes?"export ":"";
    declarations.push(prefix+"type "+rootName+" = "+rootExpression+";");
  }
  return declarations.join("\n\n");
}

function rootTypeName(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function resetOutput(placeholder=true){
  generatedText="";
  output.textContent=placeholder?"Generated TypeScript appears here.":"";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
}

function updateStats(content,parsedValue,rootName){
  const declarations=(content.match(/\b(?:interface|type)\s+[A-Za-z_$][A-Za-z0-9_$]*/g)||[]).length;
  stats.hidden=false;
  rootTypeText.textContent=rootName+" ("+rootTypeName(parsedValue)+")";
  declarationCountText.textContent=String(declarations);
  outputSizeText.textContent=byteCount(content).toLocaleString()+" bytes";
}

function generate(){
  const source=input.value;
  inputSize.textContent=source.length.toLocaleString()+" characters";
  if(!source.trim()){
    resetOutput();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const parsed=JSON.parse(source);
    const rootName=validateRootName(typeNameInput.value);
    const typeScript=buildTypeScript(parsed,rootName,{
      fallback:emptyFallbackSelect.value==="any"?"any":"unknown",
      optionalProperties:optionalPropertiesCheckbox.checked,
      readonlyProperties:readonlyPropertiesCheckbox.checked,
      exportTypes:exportTypesCheckbox.checked
    });
    generatedText=typeScript;
    output.textContent=typeScript;
    copyButton.disabled=false;
    downloadButton.disabled=false;
    updateStats(typeScript,parsed,rootName);
    setStatus("TypeScript generated successfully.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    resetOutput(false);
    setStatus(error instanceof SyntaxError?"Invalid JSON: "+error.message:error.message,"error");
  }
}

function loadJsonFile(file){
  if(file.size>10485760){
    resetOutput(false);
    fileName.textContent="";
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    resetOutput(false);
    fileName.textContent="";
    setStatus("Please choose a JSON file.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    fileName.textContent=file.name;
    generate();
  };
  reader.onerror=()=>{
    resetOutput(false);
    fileName.textContent="";
    setStatus("Could not read this file.","error");
  };
  reader.readAsText(file);
}

document.querySelector("#generateBtn").addEventListener("click",generate);
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
  input.value=JSON.stringify(sample,null,2);
  fileName.textContent="";
  generate();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
document.querySelector("#pasteBtn").addEventListener("click",async()=>{
  try{
    input.value=await navigator.clipboard.readText();
    fileName.textContent="";
    generate();
  }catch{
    setStatus("Clipboard access is unavailable. Paste JSON into the input manually.","error");
  }
});
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(file)loadJsonFile(file);
});
for(const control of [declarationStyle,exportTypesCheckbox,optionalPropertiesCheckbox,emptyFallbackSelect,readonlyPropertiesCheckbox]){
  control.addEventListener("change",()=>{
    if(input.value.trim())generate();
    else setStatus("Generation options updated. Paste or load JSON to begin.");
  });
}
input.addEventListener("input",()=>{
  inputSize.textContent=input.value.length.toLocaleString()+" characters";
  fileName.textContent="";
  resetOutput();
  setStatus(input.value.trim()?"Input changed. Generate again to update the TypeScript.":"Paste JSON or open a file to begin.");
});
typeNameInput.addEventListener("input",()=>{
  resetOutput();
  setStatus(input.value.trim()?"Root type name changed. Generate again to update the TypeScript.":"Enter a root type name, then paste or load JSON.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")generate();
});
copyButton.addEventListener("click",async()=>{
  if(!generatedText)return;
  try{
    await navigator.clipboard.writeText(generatedText);
    setStatus("TypeScript copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  if(!generatedText)return;
  const blob=new Blob([generatedText],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="types.ts";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const inputPanel=document.querySelector(".typescript-input-panel");
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