const input=document.querySelector("#jsonInput");
const inputSize=document.querySelector("#inputSize");
const result=document.querySelector("#validationResult");
const resultHeading=document.querySelector("#resultHeading");
const resultDetail=document.querySelector("#resultDetail");
const resultMeta=document.querySelector("#resultMeta");
const status=document.querySelector("#validatorStatus");
const fileInput=document.querySelector("#fileInput");

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
}

function resetResult(){
  result.classList.remove("invalid");
  result.querySelector(".validation-icon").textContent="✓";
  resultHeading.textContent="Ready to validate";
  resultDetail.textContent="Paste JSON, open a file, or load a sample.";
  resultMeta.hidden=true;
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
    result.classList.remove("invalid");
    result.querySelector(".validation-icon").textContent="✓";
    resultHeading.textContent="Valid JSON";
    resultDetail.textContent="Your JSON is syntactically correct.";
    document.querySelector("#rootType").textContent=rootType(value);
    document.querySelector("#characterCount").textContent=input.value.length.toLocaleString();
    resultMeta.hidden=false;
    setStatus("Validation complete. No syntax errors found.","success");
  }catch(error){
    result.classList.add("invalid");
    result.querySelector(".validation-icon").textContent="!";
    resultHeading.textContent="Invalid JSON";
    resultDetail.textContent=error.message;
    resultMeta.hidden=true;
    setStatus("Validation failed. Check the JSON syntax and try again.","error");
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