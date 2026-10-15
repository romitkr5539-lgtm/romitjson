const input=document.querySelector("#jsonInput");
const inputSize=document.querySelector("#inputSize");
const result=document.querySelector("#validationResult");
const resultHeading=document.querySelector("#resultHeading");
const resultDetail=document.querySelector("#resultDetail");
const resultMeta=document.querySelector("#resultMeta");
const status=document.querySelector("#validatorStatus");
const fileInput=document.querySelector("#fileInput");
const validatorOverlay=document.querySelector(".validator-text-overlay");
const validatorLineNumbers=document.querySelector(".line-number-panel");
const inputPanel=document.querySelector(".validator-input-panel");
const pasteModal=document.querySelector("#pasteModal");
const pasteArea=document.querySelector("#pasteArea");
const maxFileBytes=10*1024*1024;
const maxLiveValidationBytes=1024*1024;
let validationTimer;

function updateLineNumbers(){
  const lines=Math.max(1,(input.value||"").split("\n").length);
  if(!validatorLineNumbers)return;
  validatorLineNumbers.innerHTML=Array.from({length:lines},(_,index)=>`<span>${index+1}</span>`).join("");
}

function setTextHighlight(source,position){
  const overlay=document.querySelector(".validator-text-overlay");
  if(!overlay)return;
  overlay.replaceChildren();
  if(!source||position===null||position===undefined){
    input.classList.remove("invalid");
    return;
  }
  const start=Math.max(0,Math.min(source.length,position));
  const end=Math.min(source.length,Math.max(start+1,start+1));
  const beforeText=source.slice(0,start);
  const badText=source.slice(start,end);
  const afterText=source.slice(end);
  const before=document.createTextNode(beforeText);
  const dirty=document.createTextNode(badText);
  const highlight=document.createElement("span");
  highlight.className="invalid-highlight";
  highlight.appendChild(dirty);
  const fragment=document.createDocumentFragment();
  fragment.append(before,highlight,document.createTextNode(afterText));
  overlay.appendChild(fragment);
  input.classList.add("invalid");
}

function clearTextHighlight(){
  const overlay=document.querySelector(".validator-text-overlay");
  if(overlay)overlay.replaceChildren();
  input.classList.remove("invalid");
}

function findKnownErrorPosition(source,message){
  const lower=message.toLowerCase();
  let index=0;
  while(index<source.length){
    if(source[index]==='"'){
      index++;
      while(index<source.length){if(source[index]==="\\"){index+=2;continue}if(source[index++]==='"')break}
      continue;
    }
    if(/[A-Za-z_$]/.test(source[index])){
      const start=index++;
      while(index<source.length&&/[A-Za-z0-9_$]/.test(source[index]))index++;
      const token=source.slice(start,index);
      if(["True","False","None","undefined"].includes(token)&&lower.includes("unexpected token"))return start;
      continue;
    }
    if(source[index]===","&&lower.includes("unexpected token")&&/unexpected token ['\"]?[\]}]/i.test(message)){
      let next=index+1;while(/\s/.test(source[next]||""))next++;
      if(source[next]==="]"||source[next]==="}")return index;
    }
    index++;
  }
  return null;
}

function parseJsonError(error,source){
  const message=error&&error.message?error.message:"";
  const positionMatch=/position\s+(\d+)/i.exec(message);
  const lineMatch=/line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  let position=positionMatch?Math.max(0,Math.min(source.length,Number(positionMatch[1]))):findKnownErrorPosition(source,message);
  let line=lineMatch?Number(lineMatch[1]):null;
  let column=lineMatch?Number(lineMatch[2]):null;
    if(position===null&&/unexpected end|end of json input/i.test(message))position=source.length;
  if(position!==null){
    const parts=source.slice(0,position).split("\n");
    line=parts.length;
    column=parts[parts.length-1].length+1;
  }else if(line!==null){
    const lines=source.split("\n");
    if(line<=lines.length)position=lines.slice(0,line-1).reduce((total,value)=>total+value.length+1,0)+Math.max(0,(column||1)-1);
  }
  return{message,line,column,position,reliable:position!==null};
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status"+(type?" "+type:"");
}

function rootType(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function updateInputSize(){
  inputSize.textContent=input.value.length.toLocaleString()+" characters · "+new Blob([input.value]).size.toLocaleString()+" bytes";
  document.querySelector("#copyInputBtn").disabled=!input.value;
  document.querySelector("#downloadInputBtn").disabled=!input.value;
  updateLineNumbers();
}

function resetResult(message="Paste JSON, open a file, or load a sample."){
  clearTextHighlight();
  result.classList.remove("invalid");
  result.querySelector(".validation-icon").textContent="✓";
  resultHeading.textContent="Ready to validate";
  resultDetail.textContent=message;
  resultMeta.hidden=true;
  document.querySelector("#errorCategory").hidden=true;
  document.querySelector("#errorContext").hidden=true;
  document.querySelector("#duplicateWarning").hidden=true;
  document.querySelector("#duplicateWarning").textContent="";
  document.querySelector("#relatedTools").hidden=true;
  document.querySelector("#errorLine").textContent="—";
  document.querySelector("#errorColumn").textContent="—";
}

function setResultTiming(started,source){
  const elapsed=Math.max(0,performance.now()-started);
  document.querySelector("#inputByteCount").textContent=new Blob([source]).size.toLocaleString()+" bytes";
  document.querySelector("#validationTime").textContent=elapsed.toFixed(2)+" ms";
  resultMeta.hidden=false;
}

function sourcePosition(source,position){
  const safe=Math.max(0,Math.min(source.length,position));
  const before=source.slice(0,safe).split("\n");
  return{line:before.length,column:before[before.length-1].length+1};
}

function errorCategory(error,source,position){
  const message=(error.message||"").toLowerCase();
  const before=position===null?"":source.slice(0,position).trimEnd();
  const after=position===null?"":source.slice(position).trimStart();
  const wrongLiteral=/^(True|False|None|undefined)\b/.exec(after);
  const trailingComma=position!==null&&(source[position]===","&&/^[}\]]/.test(source.slice(position+1).trimStart())||before.endsWith(",")&&/^[}\]]/.test(after));
  if(trailingComma)return{category:"Trailing comma",suggestion:"Remove the comma immediately before the closing bracket or brace."};
  if(wrongLiteral)return{category:"Invalid JSON literal",suggestion:wrongLiteral[1]==="True"?"Use lowercase true.":wrongLiteral[1]==="False"?"Use lowercase false.":wrongLiteral[1]==="None"?"Use JSON null instead of None.":"undefined is not a JSON value; provide a valid JSON value."};
  if(message.includes("expected ':'")||message.includes("expected a colon"))return{category:"Missing colon",suggestion:"Add a colon between the quoted property name and its value."};
  if(message.includes("expected ','")||message.includes("expected a comma"))return{category:"Missing delimiter",suggestion:"Check whether a comma is needed between adjacent values or properties."};
  if(message.includes("property name")||message.includes("double-quoted"))return{category:"Invalid object key",suggestion:"JSON object keys must use double quotes, for example: \"name\": \"value\"."};
  if(message.includes("escape")||message.includes("control character"))return{category:"Invalid string",suggestion:"Check string quotes, backslashes and valid JSON escape sequences."};
  if(/unexpected token ['\"]?(t|f|n|u|T|F|N)['\"]?/i.test(message))return{category:"Unexpected token",suggestion:"JSON literals are lowercase true, false and null. undefined and None are not JSON values."};
  if(message.includes("end of json")||message.includes("unexpected end")||message.includes("unterminated"))return{category:"Unexpected end",suggestion:"Check for an unclosed string, array or object."};
  return{category:"Syntax error",suggestion:"Review the indicated source line. JSON requires double-quoted strings and keys, commas between entries, and lowercase true, false and null."};
}

function renderErrorContext(source,details){
  const pre=document.querySelector("#errorContext");pre.replaceChildren();
  if(!details.reliable||details.line===null){pre.textContent="Exact source location is unavailable in this browser.";pre.hidden=false;return}
  const lines=source.split("\n"),lineIndex=details.line-1,start=Math.max(0,lineIndex-1),end=Math.min(lines.length,lineIndex+2),width=String(end).length;
  for(let index=start;index<end;index++){
    const sourceLine=document.createElement("span");sourceLine.textContent=(index===lineIndex?"> ":"  ")+String(index+1).padStart(width," ")+" | "+lines[index]+"\n";pre.append(sourceLine);
    if(index===lineIndex){const caret=document.createElement("span");caret.className="error-caret";const prefix="  "+String(index+1).padStart(width," ")+" | ";caret.textContent="  "+" ".repeat(prefix.length+Math.max(0,details.column-1))+"^\n";pre.append(caret)}
  }
  pre.hidden=false;
}

function findDuplicateKeys(source){
  const duplicates=[];let index=0,depthLimit=false;
  const skip=()=>{while(index<source.length&&/\s/.test(source[index]))index++};
  function readString(){
    const start=index++;
    while(index<source.length){if(source[index]==="\\"){index+=2;continue}if(source[index++]==='"')break}
    return{value:JSON.parse(source.slice(start,index)),start};
  }
  function visit(path,depth){
    if(depth>500){depthLimit=true;return}
    skip();const character=source[index];
    if(character==="{"){
      index++;skip();const seen=new Map();
      while(source[index]!=="}"&&index<source.length){
        const token=readString(),key=token.value,keyPath=pathForKey(path,key);
        if(seen.has(key)){const location=sourcePosition(source,token.start);duplicates.push({key,path:keyPath,line:location.line,column:location.column})}else seen.set(key,true);
        skip();index++;visit(keyPath,depth+1);skip();if(source[index]!==",")break;index++;skip();
      }
      index++;
    }else if(character==="["){
      index++;skip();let item=0;
      while(source[index]!=="]"&&index<source.length){visit(path+"["+item+++"]",depth+1);skip();if(source[index]!==",")break;index++;skip()}
      index++;
    }else if(character==='"')readString();
    else if(character==="t")index+=4;
    else if(character==="f")index+=5;
    else if(character==="n")index+=4;
    else{const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));if(match)index+=match[0].length}
  }
  visit("$",0);
  return{duplicates,depthLimit};
}

function pathForKey(parent,key){
  return/^[A-Za-z_$][\w$]*$/.test(key)?parent+"."+key:parent+"["+JSON.stringify(key)+"]";
}

function validateJson(){
  clearTimeout(validationTimer);
  const source=input.value;
  updateInputSize();
  if(!source.trim()){
    resetResult();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  const byteSize=new Blob([source]).size;
  if(byteSize>maxFileBytes){
    resetResult("Input exceeds the 10 MiB size limit.");
    setStatus("Input exceeds the 10 MiB size limit. Remove some data before validating.","error");
    return;
  }
  const started=performance.now();
  try{
    const value=JSON.parse(source);
    clearTextHighlight();
    result.classList.remove("invalid");
    result.querySelector(".validation-icon").textContent="✓";
    resultHeading.textContent="Valid JSON";
    resultDetail.textContent="Your original input is valid JSON. Validation did not modify it.";
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#errorLine").textContent="—";
    document.querySelector("#errorColumn").textContent="—";
    document.querySelector("#errorCategory").hidden=true;
    document.querySelector("#errorContext").hidden=true;
    document.querySelector("#relatedTools").hidden=false;
    let duplicateResult;
    try{duplicateResult=findDuplicateKeys(source)}
    catch(error){duplicateResult={duplicates:[],depthLimit:true}}
    const warning=document.querySelector("#duplicateWarning");
    if(duplicateResult.duplicates.length||duplicateResult.depthLimit){
      warning.hidden=false;
      const duplicateSummary=duplicateResult.duplicates.slice(0,10).map(item=>item.path+" (line "+item.line+", column "+item.column+")").join("; ");
      warning.textContent=(duplicateResult.duplicates.length?"Duplicate object keys detected (syntax is still valid): "+duplicateSummary+(duplicateResult.duplicates.length>10?"; and "+(duplicateResult.duplicates.length-10)+" more":""):"")+(duplicateResult.depthLimit?" Duplicate-key scan stopped at its 500-level safety limit.":"");
    }else{warning.hidden=true;warning.textContent=""}
    setResultTiming(started,source);
    setStatus(duplicateResult.duplicates.length?"Valid JSON with duplicate-key warnings.":"Validation complete. No syntax errors found.",duplicateResult.duplicates.length?"warning":"success");
  }catch(error){
    const details=parseJsonError(error,source);
    const category=errorCategory(error,source,details.position);
    setTextHighlight(source,details.position);
    result.classList.add("invalid");
    result.querySelector(".validation-icon").textContent="!";
    resultHeading.textContent=details.reliable?"Invalid JSON at line "+details.line+", column "+details.column:"Invalid JSON (exact location unavailable)";
    resultDetail.textContent=category.suggestion+" Parser message: "+details.message;
    document.querySelector("#errorCategory").textContent=category.category;
    document.querySelector("#errorCategory").hidden=false;
    document.querySelector("#duplicateWarning").hidden=true;
    document.querySelector("#relatedTools").hidden=true;
    document.querySelector("#rootType").textContent="—";
    document.querySelector("#errorLine").textContent=details.reliable?String(details.line):"Unavailable";
    document.querySelector("#errorColumn").textContent=details.reliable?String(details.column):"Unavailable";
    renderErrorContext(source,details);
    setResultTiming(started,source);
    setStatus(details.reliable?"Validation failed at line "+details.line+", column "+details.column+".":"Validation failed; this browser did not provide a reliable source position.","error");
  }
  document.querySelector("#resultTitle").scrollIntoView({behavior:"smooth",block:"start"});
}

document.querySelector("#validateBtn").addEventListener("click",validateJson);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  clearTimeout(validationTimer);
  input.value="";
  fileInput.value="";
  updateInputSize();
  resetResult();
  setStatus("Validator cleared. Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2);
  updateInputSize();
  validateJson();
});
function handleInputChange(){
  clearTimeout(validationTimer);
  updateInputSize();
  clearTextHighlight();
  resetResult("Input changed. Validate to refresh the result.");
  const source=input.value,bytes=new Blob([source]).size;
  if(!source.trim()){
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  if(bytes>maxFileBytes){
    setStatus("Input exceeds the 10 MiB size limit.","error");
    return;
  }
  if(!document.querySelector("#liveValidation").checked){
    setStatus("Input changed. Select Validate JSON when ready.");
    return;
  }
  if(bytes>maxLiveValidationBytes){
    setStatus("Live validation is paused for inputs over 1 MiB. Select Validate JSON to run it manually.","error");
    return;
  }
  setStatus("Checking JSON syntax…");
  validationTimer=setTimeout(()=>{if(input.value===source&&document.querySelector("#liveValidation").checked)validateJson()},250);
}

input.addEventListener("input",handleInputChange);
document.querySelector("#liveValidation").addEventListener("change",()=>{
  clearTimeout(validationTimer);
  if(document.querySelector("#liveValidation").checked)handleInputChange();
  else if(input.value.trim())setStatus("Live validation paused. Select Validate JSON to check this input.");
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>maxFileBytes){
    fileInput.value="";setStatus("File exceeds the 10 MiB size limit. Existing input was kept unchanged.","error");return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    fileInput.value="";setStatus("Please choose a .json file. Existing input was kept unchanged.","error");return;
  }
  const reader=new FileReader();
  reader.onload=()=>{input.value=String(reader.result||"");fileInput.value="";handleInputChange();if(document.querySelector("#liveValidation").checked&&new Blob([input.value]).size<=maxLiveValidationBytes)validateJson();else setStatus(file.name+" loaded. Select Validate JSON to check it.")};
  reader.onerror=()=>{resetResult("Could not read the selected file.");setStatus("Could not read this file.","error")};
  reader.readAsText(file);
});
for(const eventName of ["dragenter","dragover"])inputPanel.addEventListener(eventName,event=>{event.preventDefault();inputPanel.classList.add("is-dragging")});
inputPanel.addEventListener("dragleave",event=>{if(!inputPanel.contains(event.relatedTarget))inputPanel.classList.remove("is-dragging")});
inputPanel.addEventListener("drop",event=>{
  event.preventDefault();inputPanel.classList.remove("is-dragging");const file=event.dataTransfer.files[0];
  if(!file){setStatus("Drop a JSON file to load it.","error");return}
  const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}));
});
document.querySelector("#copyInputBtn").addEventListener("click",async()=>{
  if(!input.value){setStatus("There is no input to copy.","error");return}
  try{await navigator.clipboard.writeText(input.value);setStatus("Input copied to clipboard.","success")}
  catch(error){setStatus("Clipboard is unavailable. Select the input and copy it manually.","error")}
});
document.querySelector("#downloadInputBtn").addEventListener("click",()=>{
  if(!input.value){setStatus("There is no input to download.","error");return}
  try{const blob=new Blob([input.value],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="input.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("JSON download started.","success")}
  catch(error){setStatus("Could not create the JSON download.","error")}
});
function closePasteDialog(){pasteModal.hidden=true;pasteModal.setAttribute("aria-hidden","true");pasteArea.value="";document.querySelector("#pasteBtn").focus()}
document.querySelector("#pasteBtn").addEventListener("click",()=>{pasteModal.hidden=false;pasteModal.setAttribute("aria-hidden","false");pasteArea.focus()});
document.querySelector("#closePasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#cancelPasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#usePasteBtn").addEventListener("click",()=>{input.value=pasteArea.value;closePasteDialog();handleInputChange();input.focus()});
pasteModal.addEventListener("click",event=>{if(event.target===pasteModal)closePasteDialog()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!pasteModal.hidden)closePasteDialog()});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")validateJson();
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