const firstInput=document.querySelector("#firstInput");
const secondInput=document.querySelector("#secondInput");
const firstFile=document.querySelector("#firstFile");
const secondFile=document.querySelector("#secondFile");
const differenceList=document.querySelector("#differenceList");
const summary=document.querySelector("#compareSummary");
const countLabel=document.querySelector("#differenceCount");
const status=document.querySelector("#compareStatus");
const copyButton=document.querySelector("#copyReportBtn");
const maxDifferences=1000;
const maxInputBytes=50*1024*1024;
const maxDepth=500;
let reportText="";
let leftData,rightData,leftNumberTokens=new Map(),rightNumberTokens=new Map(),leftOrders=new Map(),rightOrders=new Map();
let latestDifferences=[],latestCounts={added:0,removed:0,changed:0,typeChanged:0,total:0},comparisonWarnings=[];
let activeView="side";

function byteLength(text){return new Blob([String(text)]).size}

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status compare-status"+(type?" "+type:"");
}

function pathForKey(path,key){return /^[A-Za-z_$][\w$]*$/.test(key)?path+"."+key:path+"["+JSON.stringify(key)+"]"}

function pathForSegments(segments){
  return segments.reduce((path,part)=>typeof part==="number"?path+"["+part+"]":pathForKey(path,part),"$");
}

function scanMetadata(source){
  const numbers=new Map(),orders=new Map();let index=0;
  const skip=()=>{while(index<source.length&&/\s/.test(source[index]))index++};
  function readString(){const start=index++;while(index<source.length){if(source[index]==="\\"){index+=2;continue}if(source[index++]==='"')break}return JSON.parse(source.slice(start,index))}
  function readValue(segments,depth){
    if(depth>maxDepth)throw new RangeError("JSON nesting exceeds the "+maxDepth+"-level comparison limit.");
    skip();const character=source[index],path=pathForSegments(segments);
    if(character==="{"){index++;skip();const keys=[];while(source[index]!=="}"&&index<source.length){const key=readString();keys.push(key);skip();index++;readValue([...segments,key],depth+1);skip();if(source[index]!==",")break;index++;skip()}index++;orders.set(path,[...new Set(keys)])}
    else if(character==="["){index++;skip();let item=0;while(source[index]!=="]"&&index<source.length){readValue([...segments,item++],depth+1);skip();if(source[index]!==",")break;index++;skip()}index++}
    else if(character==='"')readString();
    else if(character==="t")index+=4;
    else if(character==="f")index+=5;
    else if(character==="n")index+=4;
    else{const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));if(!match)throw new Error("Could not preserve numeric source tokens.");numbers.set(path,match[0]);index+=match[0].length}
  }
  readValue([],0);return{numbers,orders};
}

function canonicalNumber(token){
  let value=token.toLowerCase(),sign="";
  if(value[0]==="-"){sign="-";value=value.slice(1)}
  const parts=value.split("e"),exponent=BigInt(parts[1]||"0"),decimal=parts[0].split("."),fraction=decimal[1]||"";
  let digits=(decimal[0]+fraction).replace(/^0+/,"");
  if(!digits)return"0";
  let scale=exponent-BigInt(fraction.length);
  while(digits.endsWith("0")){digits=digits.slice(0,-1);scale++}
  return sign+digits+"e"+scale.toString();
}

function jsonKind(value){return value===null?"null":Array.isArray(value)?"array":typeof value==="object"?"object":typeof value}

function serializeValue(value,segments,tokens,orders,indent=2,depth=0){
  if(depth>maxDepth)throw new RangeError("Value exceeds the comparison depth limit.");
  const path=pathForSegments(segments);
  if(value===null||typeof value!=="object")return typeof value==="number"?(tokens.get(path)||String(value)):JSON.stringify(value);
  const array=Array.isArray(value),keys=array?value.map((_,index)=>index):(orders.get(path)||Object.keys(value)).filter(key=>Object.hasOwn(value,key));
  const entries=array?keys.map(index=>[index,value[index]]):keys.map(key=>[key,value[key]]);
  if(!entries.length)return array?"[]":"{}";
  const indentText=" ".repeat(indent),childIndent=indentText.repeat(depth+1),parentIndent=indentText.repeat(depth);
  const lines=entries.map(([key,item])=>{
    const part=serializeValue(item,[...segments,key],tokens,orders,indent,depth+1);
    return childIndent+(array?part:JSON.stringify(key)+": "+part);
  });
  return array?"[\n"+lines.join(",\n")+"\n"+parentIndent+"]":"{\n"+lines.join(",\n")+"\n"+parentIndent+"}";
}

function valueText(value,segments=[],side="A"){
  if(value===MISSING)return"—";
  return serializeValue(value,segments,side==="A"?leftNumberTokens:rightNumberTokens,side==="A"?leftOrders:rightOrders);
}
const MISSING=Symbol("missing JSON property");

function parseJsonPath(path){
  if(path==="$" )return[];
  if(!path.startsWith("$"))throw new Error("Path must start with $.");
  const segments=[];let index=1;
  while(index<path.length){
    if(path[index]==="."){index++;const start=index;while(index<path.length&&/[A-Za-z0-9_$]/.test(path[index]))index++;if(index===start)throw new Error("Expected a property name after '.'.");segments.push(path.slice(start,index));continue}
    if(path[index]==="["){
      index++;if(path[index]==='"'){
        const start=index++;while(index<path.length){if(path[index]==="\\"){index+=2;continue}if(path[index++]==='"')break}
        const key=JSON.parse(path.slice(start,index));if(path[index++]!=="]")throw new Error("Expected closing ']'.");segments.push(key);continue;
      }
      const start=index;while(index<path.length&&/\d/.test(path[index]))index++;
      if(start===index||path[index++]!=="]")throw new Error("Use numeric array indexes or quoted object keys inside brackets.");segments.push(Number(path.slice(start,index-1)));continue;
    }
    throw new Error("Unsupported JSONPath syntax near "+path.slice(index)+".");
  }
  return segments;
}

function matchesIgnored(segments,ignored){
  return ignored.some(path=>path.length<=segments.length&&path.every((part,index)=>part===segments[index]));
}

function canonicalValue(value,segments,tokens,ignoreOrder){
  if(value===null)return"null";
  if(typeof value==="number")return"number:"+canonicalNumber(tokens.get(pathForSegments(segments))||String(value));
  if(typeof value!=="object")return typeof value+":"+JSON.stringify(value);
  if(Array.isArray(value)){
    const values=value.map((item,index)=>canonicalValue(item,[...segments,index],tokens,ignoreOrder));
    if(ignoreOrder)values.sort();
    return"array:["+values.join(",")+"]";
  }
  const keys=Object.keys(value).sort();
  return"object:{"+keys.map(key=>JSON.stringify(key)+":"+canonicalValue(value[key],[...segments,key],tokens,ignoreOrder)).join(",")+"}";
}

function addDifference(state,kind,segmentsA,segmentsB,left,right,typeA,typeB){
  if(state.items.length>=maxDifferences){state.truncated=true;return}
  const pathA=segmentsA===null?null:pathForSegments(segmentsA),pathB=segmentsB===null?null:pathForSegments(segmentsB);
  state.items.push({kind,path:pathA||pathB,pathA,pathB,segmentsA,segmentsB,left,right,typeA:typeA||jsonKind(left),typeB:typeB||jsonKind(right)});
}

function typeChange(left,right){return jsonKind(left)!==jsonKind(right)}

function compareArrayById(left,right,segmentsA,segmentsB,state,depth){
  const key=document.querySelector("#arrayMatchKey").value;
  const build=(array,base,tokens)=>{
    const map=new Map();let ambiguous=false;
    for(let index=0;index<array.length;index++){
      const value=array[index];if(!value||typeof value!=="object"||Array.isArray(value)||!Object.hasOwn(value,key)){ambiguous=true;break}
      const id=value[key],idPath=[...base,index,key];if(id===null||typeof id==="object"){ambiguous=true;break}
      const signature=canonicalValue(id,idPath,tokens,false);if(map.has(signature)){ambiguous=true;break}
      map.set(signature,{value,index});
    }
    return{map,ambiguous};
  };
  const leftMap=build(left,segmentsA,leftNumberTokens),rightMap=build(right,segmentsB,rightNumberTokens);
  if(leftMap.ambiguous||rightMap.ambiguous||left.length!==leftMap.map.size||right.length!==rightMap.map.size){state.warnings.push("Array ID matching is ambiguous or missing IDs; this array was compared by index.");compareArraysByIndex(left,right,segmentsA,segmentsB,state,depth);return}
  const signatures=new Set([...leftMap.map.keys(),...rightMap.map.keys()]);
  for(const signature of signatures){
    const oldItem=leftMap.map.get(signature),newItem=rightMap.map.get(signature);
    if(!oldItem)addDifference(state,"added",null,[...segmentsB,newItem.index],MISSING,newItem.value,"missing",jsonKind(newItem.value));
    else if(!newItem)addDifference(state,"removed",[...segmentsA,oldItem.index],null,oldItem.value,MISSING,jsonKind(oldItem.value),"missing");
    else compareValues(oldItem.value,newItem.value,[...segmentsA,oldItem.index],[...segmentsB,newItem.index],state,depth+1);
  }
}

function compareArraysAsMultisets(left,right,segmentsA,segmentsB,state,depth){
  const signature=(value,segments,tokens)=>canonicalValue(value,segments,tokens,true),rightBuckets=new Map();
  right.forEach((value,index)=>{const key=signature(value,[...segmentsB,index],rightNumberTokens);if(!rightBuckets.has(key))rightBuckets.set(key,[]);rightBuckets.get(key).push(index)});
  const matchedRight=new Set();
  left.forEach((value,index)=>{
    const key=signature(value,[...segmentsA,index],leftNumberTokens),bucket=rightBuckets.get(key);
    if(bucket&&bucket.length)matchedRight.add(bucket.shift());
    else addDifference(state,"removed",[...segmentsA,index],null,value,MISSING,jsonKind(value),"missing");
  });
  right.forEach((value,index)=>{if(!matchedRight.has(index))addDifference(state,"added",null,[...segmentsB,index],MISSING,value,"missing",jsonKind(value))});
}

function compareArraysByIndex(left,right,segmentsA,segmentsB,state,depth){
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length&&state.items.length<maxDifferences;index++){
    if(index>=left.length)addDifference(state,"added",null,[...segmentsB,index],MISSING,right[index],"missing",jsonKind(right[index]));
    else if(index>=right.length)addDifference(state,"removed",[...segmentsA,index],null,left[index],MISSING,jsonKind(left[index]),"missing");
    else compareValues(left[index],right[index],[...segmentsA,index],[...segmentsB,index],state,depth+1);
  }
  if(length>maxDifferences)state.truncated=true;
}

function compareValues(left,right,segmentsA,segmentsB,state,depth=0){
  if(state.items.length>=maxDifferences){state.truncated=true;return}
  if(depth>maxDepth)throw new RangeError("JSON nesting exceeds the "+maxDepth+"-level comparison limit.");
  if(segmentsA&&matchesIgnored(segmentsA,state.ignored)||segmentsB&&matchesIgnored(segmentsB,state.ignored))return;
  const kindA=jsonKind(left),kindB=jsonKind(right);
  if(kindA!==kindB){addDifference(state,"type-changed",segmentsA,segmentsB,left,right,kindA,kindB);return}
  if(kindA==="array"){
    if(state.options.matchByKey){compareArrayById(left,right,segmentsA,segmentsB,state,depth);return}
    if(state.options.ignoreOrder){compareArraysAsMultisets(left,right,segmentsA,segmentsB,state,depth);return}
    compareArraysByIndex(left,right,segmentsA,segmentsB,state,depth);return;
  }
  if(kindA==="object"){
    const keys=new Set([...Object.keys(left),...Object.keys(right)]);
    for(const key of keys){
      const aHas=Object.hasOwn(left,key),bHas=Object.hasOwn(right,key),aSegments=segmentsA?[...segmentsA,key]:null,bSegments=segmentsB?[...segmentsB,key]:null;
      if(!aHas){if(!matchesIgnored(bSegments,state.ignored))addDifference(state,"added",null,bSegments,MISSING,right[key],"missing",jsonKind(right[key]))}
      else if(!bHas){if(!matchesIgnored(aSegments,state.ignored))addDifference(state,"removed",aSegments,null,left[key],MISSING,jsonKind(left[key]),"missing")}
      else compareValues(left[key],right[key],aSegments,bSegments,state,depth+1);
    }
    return;
  }
  const tokenA=kindA==="number"?leftNumberTokens.get(pathForSegments(segmentsA||[])):null;
  const tokenB=kindB==="number"?rightNumberTokens.get(pathForSegments(segmentsB||[])):null;
  if(kindA==="number"?canonicalNumber(tokenA||String(left))!==canonicalNumber(tokenB||String(right)):!Object.is(left,right))addDifference(state,"changed",segmentsA,segmentsB,left,right,kindA,kindB);
}

function addValueCell(row,label,value){
  const cell=document.createElement("div");
  cell.className="difference-value";
  const title=document.createElement("label");
  title.textContent=label;
  const code=document.createElement("code");
  code.textContent=valueText(value);
  cell.append(title,code);
  row.append(cell);
}

function displayValue(value,segments,side){return value===MISSING?"—":serializeValue(value,segments||[],side==="A"?leftNumberTokens:rightNumberTokens,side==="A"?leftOrders:rightOrders)}

function reportFor(items){
  return items.map(item=>{
    const path=item.pathA&&item.pathB&&item.pathA!==item.pathB?"JSON A "+item.pathA+" -> JSON B "+item.pathB:item.pathA||item.pathB;
    return item.kind.toUpperCase()+" "+path+"\n  JSON A: "+displayValue(item.left,item.segmentsA,"A")+"\n  JSON B: "+displayValue(item.right,item.segmentsB,"B");
  }).join("\n\n");
}

function countsFor(items){
  return{added:items.filter(item=>item.kind==="added").length,removed:items.filter(item=>item.kind==="removed").length,changed:items.filter(item=>item.kind==="changed").length,typeChanged:items.filter(item=>item.kind==="type-changed").length,total:items.length};
}

function updateCounts(counts){
  latestCounts=counts;
  document.querySelector("#addedCount").textContent=counts.added.toLocaleString();
  document.querySelector("#removedCount").textContent=counts.removed.toLocaleString();
  document.querySelector("#changedCount").textContent=counts.changed.toLocaleString();
  document.querySelector("#typeChangedCount").textContent=counts.typeChanged.toLocaleString();
  document.querySelector("#totalCount").textContent=counts.total.toLocaleString();
  document.querySelector("#compareCounts").hidden=false;
}

function displayPath(item){
  if(item.pathA&&item.pathB&&item.pathA!==item.pathB)return"A: "+item.pathA+" → B: "+item.pathB;
  return item.pathA||item.pathB||"$";
}

function navigateToDifference(row,item){
  const side=item.pathA?"A":"B",target=side==="A"?firstInput:secondInput;
  target.focus();target.closest(".compare-input-panel").classList.add("difference-target");
  setTimeout(()=>target.closest(".compare-input-panel").classList.remove("difference-target"),900);
  setStatus("Selected difference at "+displayPath(item)+" in JSON "+side+".","success");
}

function makeDifferenceRow(item,compact=false){
  const row=document.createElement("article");row.className="difference-row"+(compact?" compact":"");row.dataset.path=displayPath(item);row.tabIndex=0;
  const heading=document.createElement("div");heading.className="difference-heading";
  const path=document.createElement("code");path.className="difference-path";path.textContent=displayPath(item);
  const kind=document.createElement("span");kind.className="difference-kind "+(item.kind==="type-changed"?"type-changed":item.kind);kind.textContent=item.kind==="type-changed"?"TYPE CHANGE":item.kind;
  heading.append(path,kind);row.append(heading);
  if(item.kind==="type-changed"){
    const types=document.createElement("p");types.className="type-change-note";types.textContent="Type: "+item.typeA+" → "+item.typeB;row.append(types);
  }
  if(item.left!==MISSING)addValueCell(row,"JSON A · "+item.typeA,displayValue(item.left,item.segmentsA,"A"));
  else addValueCell(row,"JSON A","—");
  if(item.right!==MISSING)addValueCell(row,"JSON B · "+item.typeB,displayValue(item.right,item.segmentsB,"B"));
  else addValueCell(row,"JSON B","—");
  row.addEventListener("click",()=>navigateToDifference(row,item));
  row.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();navigateToDifference(row,item)}});
  return row;
}

function renderRows(container,items,compact=false){
  const fragment=document.createDocumentFragment();
  for(const item of items)fragment.append(makeDifferenceRow(item,compact));
  container.replaceChildren(fragment);
}

function unifiedText(item){
  const lines=[];
  if(item.kind==="added")lines.push("+ "+item.pathB+": "+displayValue(item.right,item.segmentsB,"B"));
  else if(item.kind==="removed")lines.push("- "+item.pathA+": "+displayValue(item.left,item.segmentsA,"A"));
  else{
    lines.push("- "+item.pathA+": "+displayValue(item.left,item.segmentsA,"A"));
    lines.push("+ "+item.pathB+": "+displayValue(item.right,item.segmentsB,"B"));
  }
  return lines;
}

function renderUnified(items){
  const pre=document.querySelector("#unifiedOutput");pre.replaceChildren();
  for(const item of items){
    const group=document.createElement("span");group.className="unified-group";group.tabIndex=0;group.dataset.path=displayPath(item);
    for(const line of unifiedText(item)){
      const element=document.createElement("span");element.className="unified-line "+(line.startsWith("+")?"added":line.startsWith("-")?"removed":"changed");element.textContent=line+"\n";group.append(element);
    }
    group.addEventListener("click",()=>navigateToDifference(group,item));pre.append(group);
  }
}

function setView(view){
  activeView=view;
  const choices=[["side","sideBySideBtn"],["unified","unifiedBtn"],["changes","changesOnlyBtn"]];
  for(const[name,id]of choices){const button=document.querySelector("#"+id),selected=name===view;button.classList.toggle("active",selected);button.setAttribute("aria-selected",String(selected))}
  differenceList.hidden=view!=="side";
  document.querySelector("#unifiedOutput").hidden=view!=="unified";
  document.querySelector("#changesOnlyList").hidden=view!=="changes";
  if(view==="unified")renderUnified(latestDifferences);
  if(view==="changes")renderRows(document.querySelector("#changesOnlyList"),latestDifferences,true);
}

function renderDifferences(items){
  latestDifferences=items;reportText=reportFor(items);renderRows(differenceList,items);renderUnified(items);renderRows(document.querySelector("#changesOnlyList"),items,true);updateCounts(countsFor(items));setView(activeView);
}

function clearReport(message="Add two JSON documents and compare them."){
  reportText="";latestDifferences=[];latestCounts={added:0,removed:0,changed:0,typeChanged:0,total:0};comparisonWarnings=[];
  differenceList.replaceChildren();document.querySelector("#unifiedOutput").replaceChildren();document.querySelector("#changesOnlyList").replaceChildren();
  copyButton.disabled=true;document.querySelector("#downloadReportBtn").disabled=true;
  countLabel.textContent="No comparison yet";summary.className="compare-summary";summary.textContent=message;
  document.querySelector("#compareCounts").hidden=true;
}

function compareJson(){
  clearReport();
  let left,right;
  try{if(byteLength(firstInput.value)>maxInputBytes)throw new Error("JSON A exceeds the 50 MiB comparison limit.");if(!firstInput.value.trim())throw new Error("JSON A is empty.");left=JSON.parse(firstInput.value);const metadata=scanMetadata(firstInput.value);leftNumberTokens=metadata.numbers;leftOrders=metadata.orders}
  catch(error){summary.textContent=error.message;summary.classList.add("error");setStatus("Could not compare JSON A: "+error.message,"error");return}
  try{if(byteLength(secondInput.value)>maxInputBytes)throw new Error("JSON B exceeds the 50 MiB comparison limit.");if(!secondInput.value.trim())throw new Error("JSON B is empty.");right=JSON.parse(secondInput.value);const metadata=scanMetadata(secondInput.value);rightNumberTokens=metadata.numbers;rightOrders=metadata.orders}
  catch(error){summary.textContent=error.message;summary.classList.add("error");setStatus("Could not compare JSON B: "+error.message,"error");return}
  let ignored=[];
  try{ignored=document.querySelector("#ignoredPaths").value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean).map(parseJsonPath)}
  catch(error){summary.classList.add("error");summary.textContent="Invalid ignored path: "+error.message;setStatus("Fix the ignored JSONPath before comparing.","error");return}
  const state={items:[],truncated:false,warnings:[],ignored,options:{ignoreOrder:document.querySelector("#ignoreArrayOrder").checked,matchByKey:document.querySelector("#matchArrayObjects").checked}};
  try{compareValues(left,right,[],[],state,0)}
  catch(error){clearReport("Could not complete comparison: "+error.message);summary.classList.add("error");setStatus("Comparison stopped: "+error.message,"error");return}
  comparisonWarnings=state.warnings;renderDifferences(state.items);
  const counts=latestCounts;
  if(!counts.total){summary.textContent="These documents are equivalent under the selected comparison options.";summary.classList.add("match");countLabel.textContent="No differences";reportText="No differences found."}
  else{
    const countSummary=counts.added+" added, "+counts.removed+" removed, "+counts.changed+" changed, "+counts.typeChanged+" type changes";
    summary.textContent=(state.truncated?"Showing the first "+maxDifferences.toLocaleString()+" differences. ":"")+countSummary+". Counts are per differing leaf; type changes are reported separately and included in Total.";
    countLabel.textContent=counts.total.toLocaleString()+(counts.total===1?" difference":" differences");
    reportText=reportFor(state.items)+ (state.truncated?"\n\nDiff truncated at "+maxDifferences+" differences.":"");
  }
  if(state.warnings.length)summary.textContent+=" "+[...new Set(state.warnings)].join(" ");
  copyButton.disabled=false;document.querySelector("#downloadReportBtn").disabled=false;
  setStatus("Comparison complete. Object order is ignored; arrays are compared by index unless an option is selected.","success");
  document.querySelector("#resultsTitle").scrollIntoView({behavior:"smooth",block:"start"});
}

function updateInputSize(textarea,label){label.textContent=textarea.value.length.toLocaleString()+" characters · "+byteLength(textarea.value).toLocaleString()+" bytes"}

document.querySelector("#compareBtn").addEventListener("click",compareJson);
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  firstInput.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","validate"],settings:{theme:"light"},private:true},null,2);
  secondInput.value=JSON.stringify({name:"RomitJSON",version:"1.1",tools:["format","validate","compare"],settings:{theme:"dark"},active:true},null,2);
  updateInputSize(firstInput,document.querySelector("#firstSize"));updateInputSize(secondInput,document.querySelector("#secondSize"));compareJson();
});
document.querySelector("#swapBtn").addEventListener("click",()=>{
  const value=firstInput.value;firstInput.value=secondInput.value;secondInput.value=value;
  const firstName=document.querySelector("#firstTitle"),secondName=document.querySelector("#secondTitle"),label=firstName.textContent;firstName.textContent=secondName.textContent;secondName.textContent=label;
  updateInputSize(firstInput,document.querySelector("#firstSize"));updateInputSize(secondInput,document.querySelector("#secondSize"));clearReport("Inputs swapped. Compare again to refresh the result.");setStatus("JSON A and JSON B were swapped.");
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  firstInput.value="";secondInput.value="";firstFile.value="";secondFile.value="";
  document.querySelector("#firstTitle").textContent="JSON A";document.querySelector("#secondTitle").textContent="JSON B";
  updateInputSize(firstInput,document.querySelector("#firstSize"));updateInputSize(secondInput,document.querySelector("#secondSize"));clearReport();setStatus("Compare cleared. Your documents stay in this browser.");firstInput.focus();
});
function openJsonFile(fileInput,target,sizeLabel){
  const file=fileInput.files[0];if(!file)return;
  if(file.size>maxInputBytes){fileInput.value="";setStatus("File exceeds the 50 MiB comparison limit. Existing input was kept.","error");return}
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){fileInput.value="";setStatus("Please choose a JSON file. Existing input was kept.","error");return}
  const reader=new FileReader();
  reader.onload=()=>{target.value=String(reader.result||"");fileInput.value="";updateInputSize(target,sizeLabel);clearReport("File loaded. Compare again to update results.");setStatus(file.name+" loaded locally.")};
  reader.onerror=()=>{fileInput.value="";setStatus("Could not read this file. Existing input was kept.","error")};reader.readAsText(file);
}
document.querySelector("#openFirstBtn").addEventListener("click",()=>firstFile.click());document.querySelector("#openSecondBtn").addEventListener("click",()=>secondFile.click());
firstFile.addEventListener("change",()=>openJsonFile(firstFile,firstInput,document.querySelector("#firstSize")));
secondFile.addEventListener("change",()=>openJsonFile(secondFile,secondInput,document.querySelector("#secondSize")));
for(const[inputElement,sizeLabel]of [[firstInput,document.querySelector("#firstSize")],[secondInput,document.querySelector("#secondSize")]]){
  inputElement.addEventListener("input",()=>{updateInputSize(inputElement,sizeLabel);clearReport("Input changed. Compare again to refresh results.");setStatus("Input changed. Previous results were cleared.")});
  inputElement.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter")compareJson()});
}
for(const selector of ["#ignoreArrayOrder","#matchArrayObjects","#arrayMatchKey","#ignoredPaths"]){document.querySelector(selector).addEventListener("input",()=>{clearReport("Options changed. Compare again to refresh results.");setStatus("Comparison options changed.")});document.querySelector(selector).addEventListener("change",()=>{clearReport("Options changed. Compare again to refresh results.");setStatus("Comparison options changed.")})}
document.querySelector("#matchArrayObjects").addEventListener("change",event=>{document.querySelector("#arrayMatchKey").disabled=!event.target.checked});
for(const[id,view]of [["sideBySideBtn","side"],["unifiedBtn","unified"],["changesOnlyBtn","changes"]])document.querySelector("#"+id).addEventListener("click",()=>setView(view));
for(const[id,fileInput,target]of [["firstInput",firstFile,firstInput],["secondInput",secondFile,secondInput]]){
  const panel=target.closest(".compare-input-panel");
  panel.addEventListener("dragover",event=>{event.preventDefault();panel.classList.add("is-dragging")});
  panel.addEventListener("dragleave",event=>{if(!panel.contains(event.relatedTarget))panel.classList.remove("is-dragging")});
  panel.addEventListener("drop",event=>{event.preventDefault();panel.classList.remove("is-dragging");const dropped=event.dataTransfer.files[0];if(!dropped){setStatus("Drop a JSON file to load it.","error");return}const transfer=new DataTransfer();transfer.items.add(dropped);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}))});
}
copyButton.addEventListener("click",async()=>{
  if(!reportText){setStatus("Compare two JSON documents before copying a report.","error");return}
  try{await navigator.clipboard.writeText(reportText);setStatus("Comparison report copied to clipboard.","success")}
  catch(error){setStatus("Clipboard unavailable. Select the report text to copy it.","error")}
});
document.querySelector("#downloadReportBtn").addEventListener("click",()=>{
  if(!reportText){setStatus("Compare two JSON documents before downloading a report.","error");return}
  try{const blob=new Blob([reportText],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="json-differences.txt";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("Difference report download started.","success")}
  catch(error){setStatus("Could not create the report download.","error")}
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