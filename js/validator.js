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

function updateLineNumbers(){
  const lines=Math.max(1,(input.value||"").split("\n").length);
  if(!validatorLineNumbers)return;
  validatorLineNumbers.innerHTML=Array.from({length:lines},(_,index)=>`<span>${index+1}</span>`).join("");
}

function setTextHighlight(source,error){
  const overlay=document.querySelector(".validator-text-overlay");
  if(!overlay)return;
  overlay.replaceChildren();
  if(!source||!error){
    input.classList.remove("invalid");
    return;
  }
  const match=/at position\s+(\d+)/i.exec(error.message||"");
  const position=match?Math.max(0,Math.min(source.length,Number(match[1]))):source.length;
  const start=Math.max(0,position-1);
  const end=Math.min(source.length,position+1);
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

function parseJsonError(error,source){
  const message=error&&error.message?error.message:"";
  const nativeLocation=/line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if(nativeLocation)return {message,line:Number(nativeLocation[1]),column:Number(nativeLocation[2])};
  const positionMatch=/at position\s+(\d+)/i.exec(message);
  if(positionMatch&&typeof source==="string"){
    const before=source.slice(0,Number(positionMatch[1]));
    const lines=before.split(/\r\n|\r|\n/);
    return {message,line:lines.length,column:lines[lines.length-1].length+1,position:Number(positionMatch[1])};
  }
  const columnMatch=/column\s+(\d+)/i.exec(message);
  if(columnMatch)return {message,line:null,column:Number(columnMatch[1])};
  return {message,line:null,column:null,position:null};
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
  inputSize.textContent=input.value.length.toLocaleString()+" characters";
  updateLineNumbers();
}

function resetResult(){
  clearTextHighlight();
  result.classList.remove("invalid");
  result.querySelector(".validation-icon").textContent="✓";
  resultHeading.textContent="Ready to validate";
  resultDetail.textContent="Paste JSON, open a file, or load a sample.";
  resultMeta.hidden=true;
  document.querySelector("#errorColumn").textContent="—";
  setStatus("Your JSON stays in this browser.");
}

function validateJson(){
  const source=input.value.trim();
  updateInputSize();
  if(!source){
    resetResult();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const value=JSON.parse(source);
    clearTextHighlight();
    result.classList.remove("invalid");
    result.querySelector(".validation-icon").textContent="✓";
    resultHeading.textContent="Valid JSON";
    resultDetail.textContent="Your JSON is syntactically correct.";
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#characterCount").textContent=input.value.length.toLocaleString();
    document.querySelector("#errorColumn").textContent="—";
    resultMeta.hidden=false;
    setStatus("Validation complete. No syntax errors found.","success");
  }catch(error){
    const details=parseJsonError(error,source);
    const columnText=details.column!==null?String(details.column):"?";
    setTextHighlight(source,error);
    result.classList.add("invalid");
    result.querySelector(".validation-icon").textContent="!";
    resultHeading.textContent=details.line!==null?`Invalid JSON at line ${details.line}, column ${columnText}`:`Invalid JSON at column ${columnText}`;
    resultDetail.textContent=details.message;
    document.querySelector("#errorColumn").textContent=columnText;
    resultMeta.hidden=false;
    setStatus(details.line!==null?`Validation failed at line ${details.line}, column ${columnText}. Check the JSON syntax and try again.`:`Validation failed at column ${columnText}. Check the JSON syntax and try again.`,"error");
  }
  document.querySelector("#resultTitle").scrollIntoView({behavior:"smooth",block:"start"});
}

document.querySelector("#validateBtn").addEventListener("click",validateJson);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  updateInputSize();
  resetResult();
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2);
  validateJson();
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
    validateJson();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
input.addEventListener("input",updateInputSize);
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