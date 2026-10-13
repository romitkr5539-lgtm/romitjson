const input=document.querySelector("#jsonInput");
const output=document.querySelector("#jsonOutput");
const status=document.querySelector("#formatterStatus");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status"+(type?" "+type:"");
}

function formatJson(){
  const source=input.value.trim();
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
    output.textContent=formatted;
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
  output.textContent="Your formatted JSON will appear here.";
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
    setStatus(file.name+" loaded. Choose Format JSON to continue.");
    input.focus();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
copyButton.addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(output.textContent);
    setStatus("Formatted JSON copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  const blob=new Blob([output.textContent],{type:"application/json"});
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