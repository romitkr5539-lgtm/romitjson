const input=document.querySelector("#jsonInput");
const output=document.querySelector("#jsonOutput");
const status=document.querySelector("#minifierStatus");
const inputSize=document.querySelector("#inputSize");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");
const stats=document.querySelector("#minifierStats");
const inputPanel=input.closest(".formatter-panel");
const maxInputBytes=10*1024*1024;
const maxAutoBytes=1024*1024;
let minifiedText="";
let formattedText="";
let autoTimer;
let showingFormatted=false;

function byteCount(text){
  return new TextEncoder().encode(text).length;
}

function formatBytes(bytes){
  return bytes.toLocaleString()+" bytes";
}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status minifier-status"+(type?" "+type:"");
}

function clearResult(){
  minifiedText="";
  formattedText="";
  showingFormatted=false;
  output.textContent="";
  copyButton.disabled=true;
  downloadButton.disabled=true;
  document.querySelector("#formatOutputBtn").disabled=true;
  document.querySelector("#outputTitle").textContent="Minified output";
  document.querySelector("#formatOutputBtn").textContent="Format output";
  stats.hidden=true;
}

function minifySource(source){
  let result="",insideString=false,escaped=false;
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(insideString){
      result+=character;
      if(escaped)escaped=false;
      else if(character==="\\")escaped=true;
      else if(character==='"')insideString=false;
    }else if(character==='"'){
      insideString=true;
      result+=character;
    }else if(!/[\t\n\r ]/.test(character))result+=character;
  }
  return result;
}

function formatSource(source){
  let result="",insideString=false,escaped=false,depth=0;
  const indentation=()=>"  ".repeat(depth);
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(insideString){
      result+=character;
      if(escaped)escaped=false;
      else if(character==="\\")escaped=true;
      else if(character==='"')insideString=false;
      continue;
    }
    if(character==='"'){insideString=true;result+=character;continue}
    if(/[\t\n\r ]/.test(character))continue;
    if(character==="{"||character==="["){
      let next=index+1;while(/[\t\n\r ]/.test(source[next]||""))next++;
      if(source[next]===(character==="{"?"}":"]")){result+=character+source[next];index=next;continue}
      depth++;result+=character+"\n"+indentation();continue;
    }
    if(character==="}"||character==="]"){
      depth=Math.max(0,depth-1);result=result.trimEnd()+"\n"+indentation()+character;continue;
    }
    if(character===","){result=result.trimEnd()+",\n"+indentation();continue}
    if(character===":"){result=result.trimEnd()+": ";continue}
    result+=character;
  }
  return result;
}

function minifyJson(){
  const source=input.value;
  inputSize.textContent=formatBytes(byteCount(source));
  if(!source.trim()){
    clearResult();
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  if(byteCount(source)>maxInputBytes){
    clearResult();
    setStatus("Input exceeds the 10 MiB size limit.","error");
    return;
  }
  try{
    JSON.parse(source);
    minifiedText=minifySource(source);
    formattedText=formatSource(minifiedText);
    showingFormatted=false;
    output.textContent=minifiedText;
    document.querySelector("#outputTitle").textContent="Minified output";
    document.querySelector("#formatOutputBtn").textContent="Format output";
    copyButton.disabled=false;
    downloadButton.disabled=false;
    document.querySelector("#formatOutputBtn").disabled=false;
    const originalBytes=byteCount(source);
    const minifiedBytes=byteCount(minifiedText);
    const savedBytes=originalBytes-minifiedBytes;
    const savedPercent=originalBytes===0?0:savedBytes/originalBytes*100;
    document.querySelector("#originalSize").textContent=formatBytes(originalBytes);
    document.querySelector("#minifiedSize").textContent=formatBytes(minifiedBytes);
    document.querySelector("#bytesSaved").textContent=formatBytes(savedBytes);
    document.querySelector("#sizeSaved").textContent=savedPercent.toFixed(1)+"%";
    stats.hidden=false;
    setStatus("Valid JSON. Whitespace removed from the output.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    clearResult();
    setStatus("Invalid JSON. "+error.message,"error");
  }
}

function updateInputSize(){inputSize.textContent=formatBytes(byteCount(input.value))}

document.querySelector("#minifyBtn").addEventListener("click",minifyJson);
document.querySelector("#formatOutputBtn").addEventListener("click",()=>{
  if(!minifiedText)return;
  showingFormatted=!showingFormatted;
  output.textContent=showingFormatted?formattedText:minifiedText;
  document.querySelector("#outputTitle").textContent=showingFormatted?"Formatted preview":"Minified output";
  document.querySelector("#formatOutputBtn").textContent=showingFormatted?"Show minified":"Format output";
  setStatus(showingFormatted?"Showing a readable preview. Download still saves minified JSON.":"Showing minified JSON.","success");
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  clearTimeout(autoTimer);input.value="";fileInput.value="";document.querySelector("#fileName").textContent="Untitled JSON";updateInputSize();clearResult();
  setStatus("Minifier cleared. Paste JSON or open a file to begin.");input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","view","validate"],private:true},null,2);
  document.querySelector("#fileName").textContent="Sample JSON";updateInputSize();minifyJson();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];if(!file)return;
  if(file.size>maxInputBytes){fileInput.value="";setStatus("File exceeds the 10 MiB limit. Existing input was kept unchanged.","error");return}
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    fileInput.value="";setStatus("Please choose a JSON file. Existing input was kept unchanged.","error");return;
  }
  const reader=new FileReader();
  reader.onload=()=>{input.value=String(reader.result||"");document.querySelector("#fileName").textContent=file.name;updateInputSize();minifyJson()};
  reader.onerror=()=>setStatus("Could not read this file. Existing input was kept unchanged.","error");reader.readAsText(file);
});
input.addEventListener("input",()=>{
  clearTimeout(autoTimer);updateInputSize();clearResult();
  if(!input.value.trim()){setStatus("Paste JSON or open a file to begin.");return}
  if(byteCount(input.value)>maxInputBytes){setStatus("Input exceeds the 10 MiB limit.","error");return}
  if(!document.querySelector("#autoMinify").checked){setStatus("Input changed. Minify again to update the output.");return}
  if(byteCount(input.value)>maxAutoBytes){setStatus("Auto Minify is paused above 1 MiB. Use Minify JSON when ready.","error");return}
  setStatus("Auto Minifying…");
  const source=input.value;autoTimer=setTimeout(()=>{if(input.value===source)minifyJson()},300);
});
for(const eventName of ["dragenter","dragover"])inputPanel.addEventListener(eventName,event=>{event.preventDefault();inputPanel.classList.add("is-dragging")});
inputPanel.addEventListener("dragleave",event=>{if(!inputPanel.contains(event.relatedTarget))inputPanel.classList.remove("is-dragging")});
inputPanel.addEventListener("drop",event=>{event.preventDefault();inputPanel.classList.remove("is-dragging");const file=event.dataTransfer.files[0];if(!file){setStatus("Drop a JSON file to load it.","error");return}const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}))});
document.querySelector("#copyInputBtn").addEventListener("click",async()=>{
  if(!input.value){setStatus("There is no input to copy.","error");return}
  try{await navigator.clipboard.writeText(input.value);setStatus("Input copied to clipboard.","success")}
  catch(error){setStatus("Clipboard access is unavailable. Select the input and copy it manually.","error")}
});
function closePasteDialog(){pasteModal.hidden=true;pasteModal.setAttribute("aria-hidden","true");pasteArea.value="";document.querySelector("#pasteBtn").focus()}
document.querySelector("#pasteBtn").addEventListener("click",()=>{pasteModal.hidden=false;pasteModal.setAttribute("aria-hidden","false");pasteArea.focus()});
document.querySelector("#closePasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#cancelPasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#usePasteBtn").addEventListener("click",()=>{input.value=pasteArea.value;closePasteDialog();document.querySelector("#fileName").textContent="Pasted JSON";updateInputSize();clearResult();setStatus("Pasted input. Minify JSON to validate and create output.");input.focus()});
pasteModal.addEventListener("click",event=>{if(event.target===pasteModal)closePasteDialog()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!pasteModal.hidden)closePasteDialog()});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")minifyJson();
});
copyButton.addEventListener("click",async()=>{
  if(!minifiedText){setStatus("Minify JSON before copying output.","error");return}
  try{
    await navigator.clipboard.writeText(showingFormatted?formattedText:minifiedText);
    setStatus(showingFormatted?"Formatted preview copied to clipboard.":"Minified JSON copied to clipboard.","success");
  }catch(error){
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  if(!minifiedText){setStatus("Minify JSON before downloading output.","error");return}
  try{const blob=new Blob([minifiedText],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="minified.min.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("Minified JSON download started.","success")}
  catch(error){setStatus("Could not create the JSON download.","error")}
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