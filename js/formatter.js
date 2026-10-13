const input=document.querySelector("#jsonInput");
const output=document.querySelector("#jsonOutput");
const status=document.querySelector("#formatterStatus");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");
const inputLineNumbers=document.querySelector("#inputLineNumbers");
const outputLineNumbers=document.querySelector("#outputLineNumbers");

function updateLineNumbers(panel,text){
  const lineCount=Math.max(1,String(text).split("\n").length);
  panel.innerHTML=Array.from({length:lineCount},(_,index)=>`<span>${index+1}</span>`).join("");
}

input.addEventListener("input",()=>updateLineNumbers(inputLineNumbers,input.value));
input.addEventListener("scroll",()=>{inputLineNumbers.scrollTop=input.scrollTop;});
output.addEventListener("scroll",()=>{outputLineNumbers.scrollTop=output.scrollTop;});
updateLineNumbers(inputLineNumbers,input.value);

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status"+(type?" "+type:"");
}

function escapeHtml(value){
  return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function colorizeJson(value){
  const text=String(value);
  return escapeHtml(text).replace(/("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,(match)=>{
    if(/^"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?$/.test(match) && /:$/.test(match)){
      return '<span class="json-token json-key">'+match+'</span>';
    }
    if(/^"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"$/.test(match)){
      return '<span class="json-token json-string">'+match+'</span>';
    }
    if(/^(true|false|null)$/.test(match)){
      return '<span class="json-token json-boolean">'+match+'</span>';
    }
    if(/^[-\d.]/.test(match)){
      return '<span class="json-token json-number">'+match+'</span>';
    }
    return '<span class="json-token json-string">'+match+'</span>';
  }).replace(/[{}\[\],:]/g,(match)=>'<span class="json-token json-punctuation">'+match+'</span>');
}

function formatJson(){
  const source=input.value.trim();
  updateLineNumbers(inputLineNumbers,input.value);
  if(!source){
    output.textContent="";
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const value=JSON.parse(source);
    const indent=document.querySelector("#indentSize").value;
    const formatted=JSON.stringify(value,null,indent==="tab"?"\t":Number(indent));
    output.innerHTML=colorizeJson(formatted);
    output.dataset.raw=formatted;
    updateLineNumbers(outputLineNumbers,formatted);
    copyButton.disabled=false;
    downloadButton.disabled=false;
    setStatus("Valid JSON. Formatted output is ready.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    output.textContent="";
    copyButton.disabled=true;
    downloadButton.disabled=true;
    setStatus("Invalid JSON: "+error.message,"error");
  }
}

document.querySelector("#formatBtn").addEventListener("click",formatJson);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  updateLineNumbers(inputLineNumbers,input.value);
  output.textContent="Your formatted JSON will appear here.";
  updateLineNumbers(outputLineNumbers,output.textContent);
  copyButton.disabled=true;
  downloadButton.disabled=true;
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",tools:["format","validate","convert"],private:true},null,2);
  formatJson();
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
    updateLineNumbers(inputLineNumbers,input.value);
    setStatus(file.name+" loaded. Choose Format JSON to continue.");
    input.focus();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
copyButton.addEventListener("click",async()=>{
  const text=output.dataset.raw || output.textContent;
  try{
    await navigator.clipboard.writeText(text);
    setStatus("Formatted JSON copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  const text=output.dataset.raw || output.textContent;
  const blob=new Blob([text],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="formatted.json";
  link.click();
  URL.revokeObjectURL(url);
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")formatJson();
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
document.querySelectorAll("#mainNav a").forEach(link=>link.addEventListener("click",event=>{
  const tool=link.dataset.tool;
  if(tool){
    event.preventDefault();
    window.location.href="index.html?tool="+encodeURIComponent(tool)+"#workspace";
  }
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
}));
document.querySelector("#year").textContent=new Date().getFullYear();