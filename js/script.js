const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const sample={name:"RomitJSON",version:"1.0",tools:["format","validate","convert"],free:true};
const input=$("#jsonInput"),input2=$("#jsonInput2"),output=$("#jsonOutput"),message=$("#toolMessage"),select=$("#toolSelect"),compareWrap=$("#compareInputWrap"),fileInput=$("#fileInput"),drop=$("#dropzone");
const inputLineNumbers=$("#inputLineNumbers"),compareLineNumbers=$("#compareLineNumbers"),outputLineNumbers=$("#outputLineNumbers");
let currentExcelBlob=null,currentExcelRows=null;
function updateLineNumbers(panel,text){if(!panel)return;const count=Math.max(1,String(text||"").split("\n").length);panel.innerHTML=Array.from({length:count},(_,index)=>`<span>${index+1}</span>`).join("")}
function updateWorkspaceLineNumbers(){if(input&&inputLineNumbers)updateLineNumbers(inputLineNumbers,input.value);if(input2&&compareLineNumbers)updateLineNumbers(compareLineNumbers,input2.value);if(output&&outputLineNumbers)updateLineNumbers(outputLineNumbers,output.textContent)}
function syncLineNumbers(textarea,panel){if(textarea&&panel)textarea.addEventListener("scroll",()=>{panel.scrollTop=textarea.scrollTop})}
if(input)input.addEventListener("input",updateWorkspaceLineNumbers);if(input2)input2.addEventListener("input",updateWorkspaceLineNumbers);if(input&&inputLineNumbers)syncLineNumbers(input,inputLineNumbers);if(input2&&compareLineNumbers)syncLineNumbers(input2,compareLineNumbers);if(output&&outputLineNumbers)output.addEventListener("scroll",()=>{outputLineNumbers.scrollTop=output.scrollTop});updateWorkspaceLineNumbers();
function setMessage(t,error=false){if(!message)return;message.textContent=t;message.style.color=error?"#d85b5b":"var(--accent-dark)";updateWorkspaceLineNumbers()}
function parseText(text){try{return{value:JSON.parse(text)}}catch(e){return{error:e}}}
function pretty(v){return JSON.stringify(v,null,2)}
function escapeHtml(value){return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
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
function flattenRows(value){
  const records=Array.isArray(value)?value:[value];
  const flattened=records.map(record=>{
    const row={};
    const add=(path,item)=>{
      if(item&&typeof item==="object"&&!Array.isArray(item)){
        for(const [key,child] of Object.entries(item))add([...path,key],child);
        return;
      }
      const key=path.join(".");
      row[key]=item===null||item===undefined?"":typeof item==="object"?JSON.stringify(item):String(item);
    };
    if(record&&typeof record==="object"&&!Array.isArray(record)){
      for(const [key,item] of Object.entries(record))add([key],item);
    }else if(record!==null&&record!==undefined){
      add(["value"],record);
    }
    return row;
  });
  const headers=[...new Set(flattened.flatMap(row=>Object.keys(row)))];
  if(!headers.length)throw new Error("The JSON structure is empty or does not contain exportable values.");
  return{headers,rows:flattened.map(row=>headers.map(header=>row[header]??""))};
}
function renderTableRows(headers,rows,className,label){
  const table=document.createElement("table");
  table.className=className;
  table.setAttribute("aria-label",label);
  const head=document.createElement("thead"),headerRow=document.createElement("tr");
  for(const header of headers){const cell=document.createElement("th");cell.scope="col";cell.textContent=header;headerRow.append(cell)}
  head.append(headerRow);table.append(head);
  const body=document.createElement("tbody");
  for(const values of rows){const row=document.createElement("tr");for(const value of values){const cell=document.createElement("td");cell.textContent=String(value);row.append(cell)}body.append(row)}
  table.append(body);output.replaceChildren(table);
}
function renderCsvTable(value){const{headers,rows}=flattenRows(value);renderTableRows(headers,rows,"workspace-csv-table","CSV result table")}
function csvEscape(v){let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return/[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function toCsv(v){const{headers,rows}=flattenRows(v);return[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n")}
function createExcelExport(value){
  if(typeof XLSX==="undefined")throw new Error("Excel export is unavailable because the spreadsheet library did not load. Check your connection and try again.");
  const records=Array.isArray(value)?value:[value];
  if(!records.length)throw new Error("The JSON structure is empty or does not contain exportable values.");
  const flattened=records.map(record=>{
    const row={};
    const add=(path,item)=>{
      const key=path.join(".");
      if(item&&typeof item==="object"&&!Array.isArray(item)){
        for(const [childKey,childValue] of Object.entries(item))add([...path,childKey],childValue);
      }else{
        const text=item===null||item===undefined?"":Array.isArray(item)?item.map(entry=>entry&&typeof entry==="object"?JSON.stringify(entry):String(entry??"")).join("; "):item&&typeof item==="object"?JSON.stringify(item):String(item);
        row[key]=/^[\s=+\-@]/.test(text)?"'"+text:text;
      }
    };
    if(record&&typeof record==="object"&&!Array.isArray(record)){
      for(const [key,item] of Object.entries(record))add([key],item);
    }else{
      add(["value"],record);
    }
    return row;
  });
  const headers=[...new Set(flattened.flatMap(row=>Object.keys(row)))];
  if(!headers.length)throw new Error("The JSON structure is empty or does not contain exportable values.");
  const rows=[headers,...flattened.map(row=>headers.map(header=>row[header]??""))];
  currentExcelRows=rows;
  const worksheet=XLSX.utils.aoa_to_sheet(rows),workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,worksheet,"Sheet1");
  const bytes=XLSX.write(workbook,{bookType:"xlsx",type:"array"});
  currentExcelBlob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  return rows.map(row=>row.map(cell=>String(cell)).join("\t")).join("\n");
}
function yamlScalar(v){if(v===null)return"null";if(typeof v==="string"){if(v===""||/[:#\[\]{},&*!|>'"@]/.test(v)||/^(true|false|null|~)$/i.test(v)||/^[\-?]\s/.test(v))return JSON.stringify(v);return v}return String(v)}
function toYaml(v,indent=0){const pad=" ".repeat(indent);if(v===null||typeof v!=="object")return yamlScalar(v);if(Array.isArray(v)){if(!v.length)return"[]";return v.map(x=>x&&typeof x==="object"?pad+"-\n"+toYaml(x,indent+2):pad+"- "+toYaml(x,indent+2)).join("\n")}const keys=Object.keys(v);if(!keys.length)return"{}";return keys.map(k=>{const key=/^[A-Za-z_][A-Za-z0-9_-]*$/.test(k)?k:JSON.stringify(k),x=v[k];return x&&typeof x==="object"?pad+key+":\n"+toYaml(x,indent+2):pad+key+": "+toYaml(x,indent+2)}).join("\n")}
function xmlName(k){return String(k).replace(/[^A-Za-z0-9_.-]/g,"_").replace(/^[^A-Za-z_]+/,"_")||"item"}
function xmlEsc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function toXml(v,name="root",level=0){const p="  ".repeat(level),tag=xmlName(name);if(v===null||typeof v!=="object")return p+"<"+tag+">"+xmlEsc(v===null?"":v)+"</"+tag+">";if(Array.isArray(v))return v.length?v.map(x=>toXml(x,"item",level)).join("\n"):p+"<"+tag+"/>";const inner=Object.entries(v).map(([k,x])=>toXml(x,k,level+1)).join("\n");return inner?p+"<"+tag+">\n"+inner+"\n"+p+"</"+tag+">":p+"<"+tag+"/>"}
function typeName(v){if(v===null)return"any";if(Array.isArray(v)){if(!v.length)return"unknown[]";const types=[...new Set(v.map(typeName))];return types.length===1?types[0]+"[]":"Array<"+types.join(" | ")+">"}if(typeof v==="number")return"number";if(typeof v==="boolean")return"boolean";if(typeof v==="string")return"string";if(typeof v==="object")return"object";return"any"}
function pascal(s){return String(s).replace(/[^A-Za-z0-9]+(.)?/g,(_,c)=>c?c.toUpperCase():"").replace(/^./,c=>c.toUpperCase())||"Root"}
function inferInterfaces(v,name="Root",seen=new Set()){const defs=[];if(Array.isArray(v)){v.forEach(x=>{if(x&&typeof x==="object")defs.push(...inferInterfaces(x,name,seen))});return defs}if(!v||typeof v!=="object"||seen.has(name))return defs;seen.add(name);const lines=Object.entries(v).map(([k,x])=>{if(x&&typeof x==="object"&&!Array.isArray(x)){const n=pascal(k);defs.push(...inferInterfaces(x,n,seen));return"  "+JSON.stringify(k)+": "+n+";"}return"  "+JSON.stringify(k)+": "+typeName(x)+(x===null?" | null":"")+";"});defs.push("interface "+name+" {\n"+lines.join("\n")+"\n}");return defs}
function deepDiff(a,b,path="$",out=[]){if(Object.is(a,b))return out;if(typeof a!==typeof b||a===null||b===null){out.push(path+": "+pretty(a)+" → "+pretty(b));return out}if(Array.isArray(a)||Array.isArray(b)){if(!Array.isArray(a)||!Array.isArray(b))out.push(path+": type differs");else{if(a.length!==b.length)out.push(path+": array length "+a.length+" → "+b.length);for(let i=0;i<Math.max(a.length,b.length);i++){if(i>=a.length)out.push(path+"["+i+"]: added "+pretty(b[i]));else if(i>=b.length)out.push(path+"["+i+"]: removed "+pretty(a[i]));else deepDiff(a[i],b[i],path+"["+i+"]",out)}}return out}if(typeof a==="object"){const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of keys){if(!(k in a))out.push(path+"."+k+": added "+pretty(b[k]));else if(!(k in b))out.push(path+"."+k+": removed "+pretty(a[k]));else deepDiff(a[k],b[k],path+"."+k,out)}return out}out.push(path+": "+String(a)+" → "+String(b));return out}
function renderTree(v){const walk=(x,key="$",depth=0)=>{const pad="  ".repeat(depth);if(x&&typeof x==="object"){const entries=Array.isArray(x)?x.map((z,i)=>[i,z]):Object.entries(x);let s=pad+key+" "+(Array.isArray(x)?"[":"{")+"\n";for(const[k,z]of entries)s+=walk(z,String(k),depth+1);return s+pad+(Array.isArray(x)?"]":"}")+"\n"}return pad+key+": "+JSON.stringify(x)+"\n"};output.innerHTML=colorizeJson(walk(v));output.dataset.raw=walk(v)}
function run(){const tool=select.value,text=input.value.trim(),r=parseText(text);currentExcelBlob=null;currentExcelRows=null;if(r.error&&tool!=="editor"){output.textContent="";delete output.dataset.raw;output.parentElement.classList.remove("table-output");setMessage("Invalid JSON: "+r.error.message,true);return}try{let result="",name="";if(tool==="formatter"||tool==="editor"){result=pretty(r.value);name=tool==="editor"?"Edited JSON":"Formatted JSON";input.value=result}else if(tool==="validator"){result="✓ Valid JSON — syntax is correct.";name="Validation result"}else if(tool==="minifier"){result=JSON.stringify(r.value);name="Minified JSON"}else if(tool==="viewer"){renderTree(r.value);result=output.dataset.raw||output.textContent;name="JSON Tree"}else if(tool==="jsoncsv"){result=toCsv(r.value);name="CSV result"}else if(tool==="jsonexcel"){result=createExcelExport(r.value);name="Excel preview"}else if(tool==="jsonyaml"){result=toYaml(r.value);name="YAML result"}else if(tool==="jsonxml"){result='<?xml version="1.0" encoding="UTF-8"?>\n'+toXml(r.value);name="XML result"}else if(tool==="typescript"){const defs=inferInterfaces(r.value);result=defs.reverse().join("\n\n");name="TypeScript result"}else if(tool==="compare"){const r2=parseText(input2.value.trim());if(r2.error)throw new Error("Second JSON is invalid: "+r2.error.message);const d=deepDiff(r.value,r2.value);result=d.length?d.map(x=>"• "+x).join("\n"):"✓ The two JSON documents are identical.";name="Compare result"}output.parentElement.classList.toggle("table-output",tool==="jsoncsv"||tool==="jsonexcel");if(tool==="jsoncsv")renderCsvTable(r.value);else if(tool==="jsonexcel")renderTableRows(currentExcelRows[0],currentExcelRows.slice(1),"workspace-excel-table","Excel result table");else output.innerHTML=colorizeJson(result);output.dataset.raw=result;$("#resultTitle").textContent=name.toUpperCase();setMessage(tool==="validator"?"JSON is valid.":"Done. Result is ready to copy or download.")}catch(e){currentExcelBlob=null;currentExcelRows=null;output.textContent="";delete output.dataset.raw;output.parentElement.classList.remove("table-output");setMessage(e.message,true)}}
function updateMode(){compareWrap.classList.toggle("show",select.value==="compare")}
$$("[data-tool]").forEach(a=>a.addEventListener("click",e=>{const t=a.dataset.tool;if(t){e.preventDefault();select.value=t;updateMode();$("#workspace").scrollIntoView({behavior:"smooth"});setTimeout(run,160)}}));select.addEventListener("change",updateMode);$("#runTool").onclick=run;
$("#sampleBtn").onclick=()=>{input.value=pretty(sample);setMessage("Sample JSON loaded.")};$("#clearBtn").onclick=()=>{input.value="";input2.value="";output.textContent="";delete output.dataset.raw;output.parentElement.classList.remove("table-output");currentExcelBlob=null;currentExcelRows=null;$("#resultTitle").textContent="OUTPUT";setMessage("Workspace cleared.")};
$("#copyBtn").onclick=async()=>{const t=output.dataset.raw||output.textContent;if(!t)return setMessage("Nothing to copy.",true);try{await navigator.clipboard.writeText(t);$("#copyBtn").textContent="Copied!";setTimeout(()=>$("#copyBtn").textContent="Copy",1000)}catch(e){setMessage("Copy failed. Select the result manually.",true)}};
function download(name,text,type){const blob=text instanceof Blob?text:new Blob([text],{type:type||"text/plain"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$("#downloadBtn").onclick=()=>{if(select.value==="jsonexcel"){if(!currentExcelBlob)return setMessage("Run the Excel tool first.",true);download("result.xlsx",currentExcelBlob,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");return}const t=output.dataset.raw||output.textContent;if(!t)return setMessage("Run a tool first.",true);const map={jsoncsv:["result.csv","text/csv"],jsonyaml:["result.yaml","text/yaml"],jsonxml:["result.xml","application/xml"],typescript:["types.ts","text/plain"],compare:["comparison.txt","text/plain"],validator:["validation.txt","text/plain"],minifier:["minified.json","application/json"],formatter:["formatted.json","application/json"],viewer:["view.txt","text/plain"],editor:["edited.json","application/json"]};const[n,m]=map[select.value]||["result.txt","text/plain"];download(n,t,m)};
function loadFile(f){if(f.size>50*1024*1024){setMessage("File exceeds the 50 MiB limit.",true);return}if(!/\.json$/i.test(f.name)&&f.type!=="application/json"){setMessage("Please choose a JSON file.",true);return}const r=new FileReader;r.onload=()=>{input.value=r.result;$("#fileStatus").textContent=f.name+" loaded successfully.";setMessage("File loaded. Choose a tool and run it.");$("#workspace").scrollIntoView({behavior:"smooth"})};r.onerror=()=>setMessage("Could not read this file.",true);r.readAsText(f)}
$("#browseBtn").onclick=e=>{e.stopPropagation();fileInput.click()};const ctaButton=$("#ctaBtn");if(ctaButton)ctaButton.onclick=()=>fileInput.click();drop.addEventListener("click",e=>{if(!e.target.closest("button"))fileInput.click()});fileInput.onchange=()=>fileInput.files[0]&&loadFile(fileInput.files[0]);drop.ondragover=e=>{e.preventDefault();drop.classList.add("drag")};drop.ondragleave=()=>drop.classList.remove("drag");drop.ondrop=e=>{e.preventDefault();drop.classList.remove("drag");const f=e.dataTransfer.files[0];if(f)loadFile(f)};
const modal=$("#pasteModal");$("#pasteBtn").onclick=e=>{e.stopPropagation();modal.classList.add("open");modal.setAttribute("aria-hidden","false");$("#pasteArea").focus()};$("#closeModal").onclick=()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true")};$("#usePaste").onclick=()=>{input.value=$("#pasteArea").value;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");$("#workspace").scrollIntoView({behavior:"smooth"});setMessage("JSON pasted. Ready to process.")};modal.addEventListener("click",e=>{if(e.target===modal)$("#closeModal").click()});
$$(".nav-drop-btn").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();const box=btn.parentElement;const isOpen=box.classList.toggle("open");$$(".nav-dropdown").forEach(x=>{if(x!==box){x.classList.remove("open");x.querySelector(".nav-drop-btn")?.setAttribute("aria-expanded","false");}});btn.setAttribute("aria-expanded",String(isOpen));}));document.addEventListener("click",event=>{if(!event.target.closest("#menuBtn")&&!event.target.closest("#mainNav")){document.querySelectorAll(".nav-dropdown").forEach(x=>{x.classList.remove("open");x.querySelector(".nav-drop-btn")?.setAttribute("aria-expanded","false");});$("#mainNav")?.classList.remove("open");$("#menuBtn")?.setAttribute("aria-expanded","false");}});$("#menuBtn").onclick=()=>{const nav=$("#mainNav");const isOpen=nav.classList.toggle("open");$("#menuBtn").setAttribute("aria-expanded",String(isOpen));};
const requestedTool=new URLSearchParams(location.search).get("tool");if(requestedTool&&[...select.options].some(option=>option.value===requestedTool))select.value=requestedTool;$("#year").textContent=new Date().getFullYear();updateMode();