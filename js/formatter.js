const input=document.querySelector("#jsonInput");
const output=document.querySelector("#jsonOutput");
const status=document.querySelector("#formatterStatus");
const copyButton=document.querySelector("#copyBtn");
const downloadButton=document.querySelector("#downloadBtn");
const fileInput=document.querySelector("#fileInput");
const inputLineNumbers=document.querySelector("#inputLineNumbers");
const outputLineNumbers=document.querySelector("#outputLineNumbers");
const inputPanel=input.closest(".formatter-panel");
const codeOutputWrap=document.querySelector("#codeOutputWrap");
const treeOutput=document.querySelector("#jsonTree");
const searchInput=document.querySelector("#formatterSearch");
const previousMatchButton=document.querySelector("#previousMatchBtn");
const nextMatchButton=document.querySelector("#nextMatchBtn");
const copyPathButton=document.querySelector("#copyPathBtn");
const expandAllButton=document.querySelector("#expandAllBtn");
const collapseAllButton=document.querySelector("#collapseAllBtn");
const pasteModal=document.querySelector("#pasteModal");
const pasteArea=document.querySelector("#pasteArea");
const maxInputBytes=10*1024*1024;
const maxNestingDepth=500;
let formattedText="";
let parsedValue;
let treeMatches=[];
let activeMatchIndex=-1;
let statsTimer;
let outputMode="code";
let numberTokens=new Map();
let objectKeyOrders=new Map();

function updateLineNumbers(panel,text){
  if(!panel)return;
  const lineCount=Math.max(1,String(text).split("\n").length);
  panel.innerHTML=Array.from({length:lineCount},(_,index)=>`<span>${index+1}</span>`).join("");
}

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

function byteLength(text){return new Blob([String(text)]).size}

function formatBytes(bytes){
  if(bytes<1024)return bytes.toLocaleString()+" bytes";
  const units=["KB","MB","GB"];
  let value=bytes/1024,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index++}
  return value.toFixed(value>=10?1:2)+" "+units[index];
}

function collectJsonMetadata(source){
  const tokens=new Map();
  const keyOrders=new Map();
  let index=0;
  const skipWhitespace=()=>{while(index<source.length&&/\s/.test(source[index]))index++};
  function readString(){
    const start=index++;
    while(index<source.length){
      if(source[index]==="\\"){index+=2;continue}
      if(source[index++]==='"')break;
    }
    return JSON.parse(source.slice(start,index));
  }
  function readValue(path,depth=0){
    if(depth>maxNestingDepth)throw new RangeError("JSON nesting exceeds the 500-level formatter limit.");
    skipWhitespace();
    const character=source[index];
    if(character==="{"){
      index++;
      skipWhitespace();
      const keys=[];
      while(source[index]!=="}"){
        const key=readString();
        keys.push(key);
        skipWhitespace();
        index++;
        readValue(propertyPath(path,key,false),depth+1);
        skipWhitespace();
        if(source[index]!==",")break;
        index++;
        skipWhitespace();
      }
      index++;
      keyOrders.set(path,[...new Set(keys)]);
    }else if(character==="["){
      index++;
      skipWhitespace();
      let itemIndex=0;
      while(source[index]!=="]"){
        readValue(propertyPath(path,String(itemIndex++),true),depth+1);
        skipWhitespace();
        if(source[index]!==",")break;
        index++;
        skipWhitespace();
      }
      index++;
    }else if(character==='"'){
      readString();
    }else if(character==="t")index+=4;
    else if(character==="f")index+=5;
    else if(character==="n")index+=4;
    else{
      const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
      if(!match)throw new Error("Unable to preserve a JSON number token.");
      tokens.set(path,match[0]);
      index+=match[0].length;
    }
  }
  readValue("$");
  return{tokens,keyOrders};
}

function objectEntries(value,path,sorted=false){
  const keys=sorted?Object.keys(value).sort((left,right)=>left.localeCompare(right)):(objectKeyOrders.get(path)||Object.keys(value));
  const currentKeys=keys.filter(key=>Object.hasOwn(value,key));
  const seen=new Set(currentKeys);
  for(const key of Object.keys(value))if(!seen.has(key)){currentKeys.push(key);seen.add(key)}
  return currentKeys.map(key=>[key,value[key]]);
}

function serializeJson(value,tokens,indentUnit="",depth=0,path="$",compact=false,sorted=false){
  if(depth>maxNestingDepth)throw new RangeError("JSON nesting exceeds the 500-level formatter limit.");
  if(value===null||typeof value!=="object"){
    if(typeof value==="number")return tokens.get(path)||JSON.stringify(value);
    return JSON.stringify(value);
  }
  const isArray=Array.isArray(value);
  const entries=isArray?value.map((item,index)=>[String(index),item]):objectEntries(value,path,sorted);
  if(!entries.length)return isArray?"[]":"{}";
  const childIndent=compact?"":indentUnit.repeat(depth+1);
  const currentIndent=compact?"":indentUnit.repeat(depth);
  const separator=compact?",":",\n";
  const members=entries.map(([key,item])=>{
    const childPath=propertyPath(path,key,isArray);
    const serialized=serializeJson(item,tokens,indentUnit,depth+1,childPath,compact,sorted);
    return isArray?childIndent+serialized:childIndent+JSON.stringify(key)+(compact?":":": ")+serialized;
  });
  return isArray?"["+(compact?members.join(separator):"\n"+members.join(separator)+"\n"+currentIndent)+"]":"{"+(compact?members.join(separator):"\n"+members.join(separator)+"\n"+currentIndent)+"}";
}

function updateStatistics(source,value,formatted="",minified=""){
  document.querySelector("#inputBytes").textContent=formatBytes(byteLength(source));
  document.querySelector("#formattedBytes").textContent=formatted?formatBytes(byteLength(formatted)):"0 bytes";
  document.querySelector("#minifiedBytes").textContent=value===undefined?"0 bytes":formatBytes(byteLength(minified));
  let objectKeys=0,arrayItems=0,maxDepth=0;
  if(value!==undefined){
    const pending=[{value,depth:0}];
    while(pending.length){
      const current=pending.pop();
      if(Array.isArray(current.value)){
        arrayItems+=current.value.length;
        maxDepth=Math.max(maxDepth,current.depth+1);
        for(const child of current.value)pending.push({value:child,depth:current.depth+1});
      }else if(current.value!==null&&typeof current.value==="object"){
        const keys=Object.keys(current.value);
        objectKeys+=keys.length;
        maxDepth=Math.max(maxDepth,current.depth+1);
        for(const key of keys)pending.push({value:current.value[key],depth:current.depth+1});
      }
    }
  }
  document.querySelector("#objectKeyCount").textContent=objectKeys.toLocaleString();
  document.querySelector("#arrayItemCount").textContent=arrayItems.toLocaleString();
  document.querySelector("#maxDepth").textContent=maxDepth.toLocaleString();
}

function parseErrorLocation(error,source){
  const message=error&&error.message?error.message:"Invalid JSON";
  const lineColumn=/line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if(lineColumn)return{line:Number(lineColumn[1]),column:Number(lineColumn[2]),message};
  const positionMatch=/position\s+(\d+)/i.exec(message);
  const position=positionMatch?Math.min(Number(positionMatch[1]),source.length):source.length;
  const before=source.slice(0,position).split("\n");
  return{line:before.length,column:before[before.length-1].length+1,message};
}

function appendHighlighted(target,text,query){
  const source=String(text);
  if(!query){target.textContent=source;return}
  const lower=source.toLocaleLowerCase();
  const needle=query.toLocaleLowerCase();
  let offset=0,matchIndex=lower.indexOf(needle);
  while(matchIndex>=0){
    target.append(document.createTextNode(source.slice(offset,matchIndex)));
    const mark=document.createElement("mark");
    mark.textContent=source.slice(matchIndex,matchIndex+query.length);
    target.append(mark);
    offset=matchIndex+query.length;
    matchIndex=lower.indexOf(needle,offset);
  }
  target.append(document.createTextNode(source.slice(offset)));
}

function propertyPath(parent,key,isArray){
  if(isArray)return parent+"["+key+"]";
  return /^[A-Za-z_$][\w$]*$/.test(key)?parent+"."+key:parent+"["+JSON.stringify(key)+"]";
}

function renderTree(value,query=searchInput.value){
  treeOutput.replaceChildren();
  treeMatches=[];
  activeMatchIndex=-1;
  const maxNodes=10000;
  let rendered=0;
  function addNode(parent,key,item,path){
    if(rendered++>=maxNodes)return;
    const row=document.createElement("div");
    row.className="tree-row";
    const isArray=Array.isArray(item);
    const isObject=item!==null&&typeof item==="object";
    const keyText=String(key);
    const valueText=isArray?"Array ("+item.length+")":isObject?"Object ("+Object.keys(item).length+")":typeof item==="number"?(numberTokens.get(path)||JSON.stringify(item)):JSON.stringify(item);
    const keyMatches=Boolean(query)&&keyText.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const valueMatches=Boolean(query)&&!isObject&&String(valueText).toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="tree-toggle";
    toggle.disabled=!isObject;
    toggle.setAttribute("aria-label",isObject?"Collapse "+keyText:"Value");
    toggle.textContent=isObject?"▾":"";
    row.append(toggle);
    const keyElement=document.createElement("span");
    keyElement.className="tree-key";
    appendHighlighted(keyElement,keyText,keyMatches?query:"");
    row.append(keyElement,document.createTextNode(": "));
    const valueElement=document.createElement("span");
    valueElement.className="tree-value";
    if(isObject)valueElement.textContent=valueText;
    else appendHighlighted(valueElement,valueText,valueMatches?query:"");
    row.append(valueElement);
    const node=document.createElement("div");
    node.className="tree-node";
    node.dataset.path=path;
    node.append(row);
    const childContainer=document.createElement("div");
    childContainer.className="tree-children";
    if(isObject){
      const entries=isArray?item.map((child,index)=>[String(index),child]):Object.entries(item);
      for(const[childKey,childValue]of entries){
        if(rendered>=maxNodes)break;
        addNode(childContainer,childKey,childValue,propertyPath(path,childKey,isArray));
      }
      if(entries.length)node.append(childContainer);
      toggle.setAttribute("aria-expanded","true");
      toggle.addEventListener("click",()=>{
        const expanded=toggle.getAttribute("aria-expanded")==="true";
        toggle.setAttribute("aria-expanded",String(!expanded));
        toggle.textContent=expanded?"▸":"▾";
        childContainer.hidden=expanded;
      });
    }
    parent.append(node);
    if(keyMatches||valueMatches)treeMatches.push({node,path});
  }
  if(value!==undefined)addNode(treeOutput,"$",value,"$");
  if(rendered>=maxNodes){
    const note=document.createElement("p");
    note.className="tree-limit-note";
    note.textContent="Tree view limited to the first 10,000 nodes. The formatted JSON is complete.";
    treeOutput.append(note);
  }
  updateMatchControls();
}

function updateMatchControls(){
  const count=treeMatches.length;
  document.querySelector("#matchCount").textContent=count?(activeMatchIndex<0?count+" matches":(activeMatchIndex+1)+" of "+count):"0 matches";
  previousMatchButton.disabled=count===0;
  nextMatchButton.disabled=count===0;
  copyPathButton.disabled=activeMatchIndex<0||count===0;
  for(const match of treeMatches)match.node.classList.remove("active-match");
  if(activeMatchIndex>=0&&treeMatches[activeMatchIndex]){
    const current=treeMatches[activeMatchIndex];
    current.node.classList.add("active-match");
    for(let parent=current.node.parentElement;parent&&parent!==treeOutput;parent=parent.parentElement){
      if(parent.classList.contains("tree-children"))parent.hidden=false;
      const owner=parent.closest(".tree-node");
      const toggle=owner&&owner.querySelector(":scope > .tree-row > .tree-toggle");
      if(toggle){toggle.setAttribute("aria-expanded","true");toggle.textContent="▾"}
    }
    current.node.scrollIntoView({block:"nearest"});
  }
}

function moveMatch(direction){
  if(!treeMatches.length)return;
  activeMatchIndex=activeMatchIndex<0?(direction>0?0:treeMatches.length-1):(activeMatchIndex+direction+treeMatches.length)%treeMatches.length;
  updateMatchControls();
}

function setOutputMode(mode){
  outputMode=mode;
  const treeMode=mode==="tree";
  codeOutputWrap.hidden=treeMode;
  treeOutput.hidden=!treeMode;
  document.querySelector("#codeViewBtn").classList.toggle("active",!treeMode);
  document.querySelector("#treeViewBtn").classList.toggle("active",treeMode);
  document.querySelector("#codeViewBtn").setAttribute("aria-pressed",String(!treeMode));
  document.querySelector("#treeViewBtn").setAttribute("aria-pressed",String(treeMode));
}

function clearFormattedOutput(placeholder=""){
  formattedText="";
  parsedValue=undefined;
  numberTokens=new Map();
  objectKeyOrders=new Map();
  output.textContent=placeholder;
  delete output.dataset.raw;
  updateLineNumbers(outputLineNumbers,placeholder);
  copyButton.disabled=true;
  downloadButton.disabled=true;
  treeOutput.replaceChildren();
  treeMatches=[];
  activeMatchIndex=-1;
  searchInput.value="";
  searchInput.disabled=true;
  previousMatchButton.disabled=true;
  nextMatchButton.disabled=true;
  copyPathButton.disabled=true;
  expandAllButton.disabled=true;
  collapseAllButton.disabled=true;
  setOutputMode("code");
  updateMatchControls();
}

function formatJson(){
  clearTimeout(statsTimer);
  const source=input.value;
  updateLineNumbers(inputLineNumbers,input.value);
  if(!source.trim()){
    clearFormattedOutput("Your formatted output will appear here.");
    updateStatistics(source,undefined);
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  if(byteLength(source)>maxInputBytes){
    clearFormattedOutput("Input exceeds the size limit.");
    updateStatistics(source,undefined);
    setStatus("Input exceeds the 10 MiB size limit.","error");
    return;
  }
  try{
    let value=JSON.parse(source);
    const metadata=collectJsonMetadata(source);
    numberTokens=metadata.tokens;
    objectKeyOrders=metadata.keyOrders;
    const sortEnabled=document.querySelector("#sortKeys").checked;
    const indent=document.querySelector("#indentSize").value;
    const indentUnit=indent==="tab"?"\t":" ".repeat(Number(indent));
    const formatted=serializeJson(value,numberTokens,indentUnit,0,"$",false,sortEnabled);
    const minified=serializeJson(value,numberTokens,"",0,"$",true,sortEnabled);
    output.innerHTML=colorizeJson(formatted);
    output.dataset.raw=formatted;
    formattedText=formatted;
    parsedValue=value;
    updateLineNumbers(outputLineNumbers,formatted);
    copyButton.disabled=false;
    downloadButton.disabled=false;
    searchInput.disabled=false;
    expandAllButton.disabled=false;
    collapseAllButton.disabled=false;
    updateStatistics(source,value,formatted,minified);
    renderTree(value,searchInput.value);
    setOutputMode(outputMode);
    setStatus("Valid JSON. Formatted output is ready.","success");
    document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    clearFormattedOutput("");
    updateStatistics(source,undefined);
    if(error instanceof SyntaxError){
      const location=parseErrorLocation(error,source);
      setStatus("Invalid JSON at line "+location.line+", column "+location.column+": "+location.message,"error");
    }else setStatus("Could not format JSON: "+error.message,"error");
  }
}

document.querySelector("#formatBtn").addEventListener("click",formatJson);
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  updateLineNumbers(inputLineNumbers,input.value);
  clearFormattedOutput("Your formatted output will appear here.");
  updateStatistics("",undefined);
  setStatus("Paste JSON or open a file to begin.");
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",tools:["format","validate","convert"],private:true},null,2);
  updateLineNumbers(inputLineNumbers,input.value);
  formatJson();
});

function updateInputState(){
  const source=input.value;
  updateLineNumbers(inputLineNumbers,source);
  clearFormattedOutput("");
  updateStatistics(source,undefined);
  clearTimeout(statsTimer);
  if(byteLength(source)>maxInputBytes){
    setStatus("Input exceeds the 10 MiB size limit.","error");
    return;
  }
  setStatus(source.trim()?"Input changed. Format again to refresh the output.":"Paste JSON or open a file to begin.");
  if(!source.trim())return;
  statsTimer=setTimeout(()=>{
    if(input.value!==source)return;
    try{
      const value=JSON.parse(source);
      const metadata=collectJsonMetadata(source);
      numberTokens=metadata.tokens;
      objectKeyOrders=metadata.keyOrders;
      const sortEnabled=document.querySelector("#sortKeys").checked;
      updateStatistics(source,value,"",serializeJson(value,numberTokens,"",0,"$",true,sortEnabled));
    }
    catch(error){updateStatistics(source,undefined)}
  },180);
}

input.addEventListener("input",updateInputState);
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    clearFormattedOutput("");
    updateStatistics(input.value,undefined);
    setStatus("File exceeds the 10 MiB size limit.","error");
    fileInput.value="";
    return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    clearFormattedOutput("");
    updateStatistics(input.value,undefined);
    setStatus("Please choose a JSON file.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    updateInputState();
    setStatus(file.name+" loaded. Formatting JSON...");
    formatJson();
    input.focus();
  };
  reader.onerror=()=>{
    clearFormattedOutput("");
    updateStatistics(input.value,undefined);
    setStatus("Could not read this file.","error");
  };
  reader.readAsText(file);
});
for(const eventName of ["dragenter","dragover"]){
  inputPanel.addEventListener(eventName,event=>{
    event.preventDefault();
    inputPanel.classList.add("is-dragging");
  });
}
for(const eventName of ["dragleave","drop"]){
  inputPanel.addEventListener(eventName,event=>{
    if(eventName==="drop")event.preventDefault();
    if(eventName==="drop"||!inputPanel.contains(event.relatedTarget))inputPanel.classList.remove("is-dragging");
  });
}
inputPanel.addEventListener("drop",event=>{
  const file=event.dataTransfer.files[0];
  if(!file){setStatus("Drop a JSON file to load it.","error");return}
  const transfer=new DataTransfer();
  transfer.items.add(file);
  fileInput.files=transfer.files;
  fileInput.dispatchEvent(new Event("change",{bubbles:true}));
});

function closePasteDialog(){
  pasteModal.hidden=true;
  pasteModal.setAttribute("aria-hidden","true");
  pasteArea.value="";
  document.querySelector("#pasteBtn").focus();
}
document.querySelector("#pasteBtn").addEventListener("click",()=>{
  pasteModal.hidden=false;
  pasteModal.setAttribute("aria-hidden","false");
  pasteArea.focus();
});
document.querySelector("#closePasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#cancelPasteBtn").addEventListener("click",closePasteDialog);
document.querySelector("#usePasteBtn").addEventListener("click",()=>{
  input.value=pasteArea.value;
  closePasteDialog();
  updateInputState();
  input.focus();
});
pasteModal.addEventListener("click",event=>{if(event.target===pasteModal)closePasteDialog()});
document.querySelector("#codeViewBtn").addEventListener("click",()=>setOutputMode("code"));
document.querySelector("#treeViewBtn").addEventListener("click",()=>setOutputMode("tree"));
searchInput.addEventListener("input",()=>{
  activeMatchIndex=-1;
  if(parsedValue!==undefined){
    renderTree(parsedValue,searchInput.value.trim());
    if(searchInput.value.trim())setOutputMode("tree");
  }
  updateMatchControls();
});
previousMatchButton.addEventListener("click",()=>moveMatch(-1));
nextMatchButton.addEventListener("click",()=>moveMatch(1));
expandAllButton.addEventListener("click",()=>{
  treeOutput.querySelectorAll(".tree-toggle:not(:disabled)").forEach(toggle=>{
    toggle.setAttribute("aria-expanded","true");
    toggle.textContent="▾";
    const children=toggle.closest(".tree-node").querySelector(":scope > .tree-children");
    if(children)children.hidden=false;
  });
});
collapseAllButton.addEventListener("click",()=>{
  treeOutput.querySelectorAll(".tree-toggle:not(:disabled)").forEach(toggle=>{
    toggle.setAttribute("aria-expanded","false");
    toggle.textContent="▸";
    const children=toggle.closest(".tree-node").querySelector(":scope > .tree-children");
    if(children)children.hidden=true;
  });
});
copyPathButton.addEventListener("click",async()=>{
  const match=treeMatches[activeMatchIndex];
  if(!match)return;
  try{
    await navigator.clipboard.writeText(match.path);
    setStatus("Copied property path "+match.path,"success");
  }catch(error){setStatus("Clipboard access is unavailable; property path: "+match.path,"error")}
});
copyButton.addEventListener("click",async()=>{
  if(!formattedText){setStatus("Format JSON before copying a result.","error");return}
  try{
    await navigator.clipboard.writeText(formattedText);
    setStatus("Formatted JSON copied to clipboard.","success");
  }catch(error){
    setStatus("Clipboard access is unavailable in this browser.","error");
  }
});
downloadButton.addEventListener("click",()=>{
  if(!formattedText){setStatus("Format JSON before downloading a result.","error");return}
  try{
    const blob=new Blob([formattedText],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="formatted.json";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setStatus("Could not create the JSON download.","error")}
});
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")formatJson();
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(!pasteModal.hidden)closePasteDialog();
  else if(document.activeElement===searchInput){
    searchInput.value="";
    searchInput.dispatchEvent(new Event("input"));
    setOutputMode("code");
    input.focus();
  }
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