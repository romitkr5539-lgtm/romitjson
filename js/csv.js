const input=document.querySelector("#jsonInput");
const output=document.querySelector("#csvOutput");
const status=document.querySelector("#csvStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const stats=document.querySelector("#csvStats");
let csvText="";

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status csv-status"+(type?" "+type:"");
}

function cellText(value){
  if(value===null||value===undefined)return"";
  if(typeof value==="object")return JSON.stringify(value);
  return String(value);
}

function escapeCell(value){
  let text=cellText(value);
  if(typeof value==="string"&&/^[=+\-@]/.test(text))text="'"+text;
  if(/[",\n\r]/.test(text))text='"'+text.replace(/"/g,'""')+'"';
  return text;
}

function convert(){
  const source=input.value;
  inputSize.textContent=source.length.toLocaleString()+" characters";
  if(!source.trim()){
    resetOutput();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  let value;
  try{
    value=JSON.parse(source);
  }catch(error){
    resetOutput();
    setStatus("Invalid JSON: "+error.message,"error");
    return;
  }
  if(!Array.isArray(value)){
    resetOutput();
    setStatus("JSON to CSV requires an array of objects.","error");
    return;
  }
  if(!value.every(row=>row!==null&&typeof row==="object"&&!Array.isArray(row))){
    resetOutput();
    setStatus("Every array item must be a JSON object.","error");
    return;
  }
  const headers=[...new Set(value.flatMap(row=>Object.keys(row)))];
  const rows=value.map(row=>headers.map(header=>escapeCell(row[header])));
  csvText=headers.length?[headers.map(escapeCell).join(","),...rows.map(row=>row.join(","))].join("\r\n"):"";
  output.textContent=csvText;
  copyButton.disabled=false;
  downloadButton.disabled=false;
  document.querySelector("#rowCount").textContent=value.length.toLocaleString();
  document.querySelector("#columnCount").textContent=headers.length.toLocaleString();
  document.querySelector("#csvSize").textContent=byteCount(csvText).toLocaleString()+" bytes";
  stats.hidden=false;
  setStatus(`Converted ${value.length.toLocaleString()} ${value.length===1?"row":"rows"} across ${headers.length.toLocaleString()} ${headers.length===1?"column":"columns"}.`,"success");
  document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
}

function resetOutput(){
  csvText="";
  output.textContent="";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  stats.hidden=true;
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
  input.value=JSON.stringify([{name:"Ada Lovelace",role:"Engineer",active:true},{name:"Grace Hopper",role:"Computer scientist",active:false}],null,2);
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
  setStatus(input.value.trim()?"Input changed. Convert again to update the CSV.":"Paste JSON or open a file to begin.");
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")convert();
});
copyButton.addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(csvText);
    setStatus("CSV copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  const blob=new Blob([csvText],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="converted.csv";
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