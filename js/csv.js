const input=document.querySelector("#jsonInput");
const output=document.querySelector("#csvOutput");
const status=document.querySelector("#csvStatus");
const inputSize=document.querySelector("#inputSize");
const fileInput=document.querySelector("#fileInput");
const copyButton=document.querySelector("#copyBtn");
const copyInputButton=document.querySelector("#copyInputBtn");
const downloadButton=document.querySelector("#downloadBtn");
const pasteButton=document.querySelector("#pasteBtn");
const stats=document.querySelector("#csvStats");
const delimiterSelect=document.querySelector("#delimiterSelect");
const headerRowCheckbox=document.querySelector("#headerRow");
const flattenNestedCheckbox=document.querySelector("#flattenNested");
const arrayModeSelect=document.querySelector("#arrayMode");
const includeBomCheckbox=document.querySelector("#includeBom");
const spreadsheetSafeCheckbox=document.querySelector("#spreadsheetSafe");
const columnOrderInput=document.querySelector("#columnOrder");
let csvText="";

function byteCount(text){return new TextEncoder().encode(text).length}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status csv-status"+(type?" "+type:"");
}

function currentSettings(){
  const rawDelimiter=delimiterSelect.value;
  return {
    delimiter: rawDelimiter==="\\t"?"\t":rawDelimiter,
    includeHeader: headerRowCheckbox.checked,
    flattenNested: flattenNestedCheckbox.checked,
    arrayMode: arrayModeSelect.value,
    includeBom: includeBomCheckbox.checked,
    spreadsheetSafe: spreadsheetSafeCheckbox.checked,
    columnOrder: columnOrderInput.value.trim()
  };
}

function pathToHeader(path){
  if(path.length===0)return"value";
  return path.map((segment,index)=>{
    const part=String(segment);
    if(typeof segment==="number")return '['+segment+']';
    if(index===0){
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)?part:'['+JSON.stringify(part)+']';
    }
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)?'.'+part:'['+JSON.stringify(part)+']';
  }).join('').replace(/^\./,'');
}

function normalizeText(value){
  if(value===null||value===undefined)return"";
  if(typeof value==="string")return value;
  if(typeof value==="number"||typeof value==="boolean")return String(value);
  if(Array.isArray(value))return JSON.stringify(value);
  if(typeof value==="object")return JSON.stringify(value);
  return String(value);
}

function cellValueForCsv(value,settings){
  if(value===null||value===undefined)return"";
  if(Array.isArray(value)){
    if(settings.arrayMode==="join")return value.map(item=>normalizeText(item)).join(";");
    return JSON.stringify(value);
  }
  if(typeof value==="object")return JSON.stringify(value);
  let text=String(value);
  if(settings.spreadsheetSafe&&typeof value==="string"&&/^[\s=+\-@]/.test(text))text="'"+text;
  return text;
}

function flattenRecord(record,settings,basePath=[]){
  const flat={};
  const add=(path,value)=>{
    const key=pathToHeader(path);
    if(Object.prototype.hasOwnProperty.call(flat,key)){
      let suffix=2;
      while(Object.prototype.hasOwnProperty.call(flat,key+'#'+suffix))suffix++;
      flat[key+'#'+suffix]=value;
    }else{
      flat[key]=value;
    }
  };
  for(const [key,value] of Object.entries(record)){
    const nextPath=[...basePath,key];
    if(value!==null&&typeof value==="object"&&settings.flattenNested){
      if(Array.isArray(value)){
        add(nextPath,cellValueForCsv(value,settings));
      }else{
        Object.assign(flat,flattenRecord(value,settings,nextPath));
      }
    }else{
      add(nextPath,cellValueForCsv(value,settings));
    }
  }
  return flat;
}

function parseColumnOrder(text){
  if(!text)return[];
  return text.split(/[,\n]/).map(part=>part.trim()).filter(Boolean);
}

function collectRows(data,settings){
  if(data===null||data===undefined)return {headers:[],rows:[]};
  let rows=[];
  let rawRows=[];
  if(Array.isArray(data)){
    if(!data.length)return {headers:[],rows:[]};
    rawRows=data.map(item=>{
      if(item===null||item===undefined)return {};
      if(Array.isArray(item))return {value:item};
      if(typeof item==="object")return item;
      return {value:item};
    });
  }else if(typeof data==="object"){
    rawRows=[data];
  }else{
    rawRows=[{value:data}];
  }
  const flattenedRows=rawRows.map(row=>flattenRecord(row,settings,[],[]));
  const headers=[];
  for(const row of flattenedRows){
    for(const key of Object.keys(row)){
      if(!headers.includes(key))headers.push(key);
    }
  }
  const orderedColumns=parseColumnOrder(settings.columnOrder);
  if(orderedColumns.length){
    const ordered=[];for(const name of orderedColumns){if(headers.includes(name)&&!ordered.includes(name))ordered.push(name)};for(const name of headers){if(!ordered.includes(name))ordered.push(name)};headers.splice(0,headers.length,...ordered);
  }
  rows=flattenedRows.map(row=>headers.map(header=>row[header]??""));
  return {headers,rows};
}

function escapeCsvCell(value,delimiter){
  const text=String(value==null?"":value);
  const quoteWrapped=text.includes(delimiter)||text.includes('"')||text.includes('\n')||text.includes('\r');
  return quoteWrapped?`"${text.replace(/"/g,'""')}"`:text;
}

function createCsv(data,settings){
  const {headers,rows}=collectRows(data,settings);
  if(!headers.length){
    return {headers:[],rows:[],csv:""};
  }
  const outputRows=settings.includeHeader?[headers,...rows]:rows;
  const csvRows=outputRows.map(row=>row.map(value=>escapeCsvCell(value,settings.delimiter)).join(settings.delimiter));
  let csv=csvRows.join('\r\n');
  if(settings.includeBom)csv='\uFEFF'+csv;
  return {headers,rows:outputRows, csv};
}

function resetOutput(){
  csvText="";
  output.textContent="Your CSV output will appear here.";
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
  let value;
  try{value=JSON.parse(source)}catch(error){resetOutput();setStatus("Invalid JSON: "+error.message,"error");return}
  const settings=currentSettings();
  const {headers,rows,csv}=createCsv(value,settings);
  if(!headers.length){
    resetOutput();
    setStatus("The JSON structure is empty or does not contain exportable values.","warning");
    return;
  }
  csvText=csv;
  output.textContent=csvText;
  copyButton.disabled=false;
  downloadButton.disabled=false;
  document.querySelector("#rowCount").textContent=(settings.includeHeader?Math.max(rows.length-1,0):rows.length).toLocaleString();
  document.querySelector("#columnCount").textContent=headers.length.toLocaleString();
  document.querySelector("#csvSize").textContent=byteCount(csvText).toLocaleString()+" bytes";
  stats.hidden=false;
  const rowLabel=(settings.includeHeader?Math.max(rows.length-1,0):rows.length)===1?"row":"rows";
  setStatus(`Converted ${settings.includeHeader?Math.max(rows.length-1,0):rows.length} ${rowLabel} across ${headers.length} columns.`,"success");
  document.querySelector("#outputTitle").scrollIntoView({behavior:"smooth",block:"start"});
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
  input.value=JSON.stringify([{name:"Ada Lovelace",role:"Engineer",active:true,profile:{location:"London",team:"Research"},tags:["math","logic"]},{name:"Grace Hopper",role:"Computer scientist",active:false,profile:{location:"Arlington",team:"Navy"},tags:["compiler","navy"]}],null,2);
  convert();
});
for(const element of [delimiterSelect,headerRowCheckbox,flattenNestedCheckbox,arrayModeSelect,includeBomCheckbox,spreadsheetSafeCheckbox,columnOrderInput]){
  element.addEventListener("change",()=>{
    if(input.value.trim()){
      convert();
    }else{
      setStatus("Export options updated. Paste or load JSON to convert.");
    }
  });
}
document.querySelector("#pasteBtn").addEventListener("click",async()=>{
  try{
    const text=await navigator.clipboard.readText();
    input.value=text;
    inputSize.textContent=input.value.length.toLocaleString()+" characters";
    convert();
  }catch{
    setStatus("Clipboard access is unavailable. Paste manually.","error");
  }
});
copyInputButton.addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(input.value);setStatus("JSON input copied to clipboard.","success")}catch{setStatus("Clipboard access is unavailable.","error")}
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){resetOutput();setStatus("File exceeds the 10MB limit.","error");fileInput.value="";return}
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){resetOutput();setStatus("Please choose a JSON file.","error");fileInput.value="";return}
  const reader=new FileReader();
  reader.onload=()=>{input.value=String(reader.result||"");inputSize.textContent=input.value.length.toLocaleString()+" characters";convert();};
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
  if(!csvText){setStatus("Convert JSON first before copying the CSV.","error");return}
  try{await navigator.clipboard.writeText(csvText);setStatus("CSV copied to clipboard.","success")}catch{setStatus("Clipboard access is unavailable in this browser.","error")}
});
downloadButton.addEventListener("click",()=>{
  if(!csvText){setStatus("Convert JSON first before downloading the CSV.","error");return}
  const blob=new Blob([csvText],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="converted.csv";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const inputPanel=document.querySelector(".formatter-panel");
inputPanel.addEventListener("dragover",event=>{event.preventDefault();inputPanel.classList.add("is-dragging")});
inputPanel.addEventListener("dragleave",event=>{if(!inputPanel.contains(event.relatedTarget))inputPanel.classList.remove("is-dragging")});
inputPanel.addEventListener("drop",event=>{event.preventDefault();inputPanel.classList.remove("is-dragging");const file=event.dataTransfer.files[0];if(!file){setStatus("Drop a JSON file to load it.","error");return}const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}))});

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