const input=document.querySelector("#jsonInput");
const tree=document.querySelector("#jsonTree");
const status=document.querySelector("#viewerStatus");
const fileInput=document.querySelector("#fileInput");
const searchInput=document.querySelector("#treeSearch");
const expandButton=document.querySelector("#expandAllBtn");
const collapseButton=document.querySelector("#collapseAllBtn");
const inputLineNumbers=document.querySelector("#inputLineNumbers");
const maxTreeNodes=5000;
const maxFileBytes=50*1024*1024;
const maxSearchNodes=100000;
const childPageSize=150;
let parsedData;
let hasParsedData=false;
let originalSource="";
let numberTokens=new Map();
let keyOrders=new Map();
let nodeByPath=new Map();
let currentSelection=null;
let searchMatches=[];
let currentMatch=-1;
let searchTimer;
let activeMode="tree";
let tableSort={key:"",direction:1};

function updateInputLineNumbers(){
  const lineCount=Math.max(1,(input.value||"").split("\n").length);
  inputLineNumbers.innerHTML=Array.from({length:lineCount},(_,index)=>`<span>${index+1}</span>`).join("");
}

input.addEventListener("input",updateInputLineNumbers);
input.addEventListener("scroll",()=>{inputLineNumbers.scrollTop=input.scrollTop;});
updateInputLineNumbers();

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status"+(type?" "+type:"");
}

function primitiveType(value){
  if(value===null)return"null";
  if(Array.isArray(value))return"array";
  return typeof value;
}

function makeEntry(key,value,depth,state){
  state.nodes++;
  const item=document.createElement("li");
  const type=primitiveType(value);
  item.dataset.searchText=(String(key)+" "+(type==="object"||type==="array"?type:String(value))).toLocaleLowerCase();
  if(type!=="object"&&type!=="array"){
    const row=document.createElement("div");
    row.className="tree-leaf";
    const keyElement=document.createElement("span");
    keyElement.className="tree-key";
    keyElement.textContent=key;
    const separator=document.createElement("span");
    separator.className="tree-separator";
    separator.textContent=":";
    const valueElement=document.createElement("span");
    valueElement.className="tree-value "+type;
    valueElement.textContent=type==="string"?JSON.stringify(value):String(value);
    row.append(keyElement,separator,valueElement);
    item.append(row);
    return item;
  }

  const entries=type==="array"?value.map((entry,index)=>["["+index+"]",entry]):Object.entries(value);
  const details=document.createElement("details");
  details.open=depth===0;
  details.dataset.initialOpen=String(details.open);
  const summary=document.createElement("summary");
  const keyElement=document.createElement("span");
  keyElement.className="tree-key";
  keyElement.textContent=key;
  const typeElement=document.createElement("span");
  typeElement.className="tree-kind";
  typeElement.textContent=type==="array"?"[]":"{}";
  const countElement=document.createElement("span");
  countElement.className="tree-count";
  countElement.textContent=entries.length+(entries.length===1?" item":" items");
  summary.append(keyElement,typeElement,countElement);
  details.append(summary);
  const children=document.createElement("ul");
  for(const[childKey,childValue]of entries){
    if(state.nodes>=maxTreeNodes){
      state.truncated=true;
      break;
    }
    children.append(makeEntry(childKey,childValue,depth+1,state));
  }
  if(state.truncated){
    const notice=document.createElement("li");
    notice.className="tree-limit";
    notice.textContent="Tree display limited to "+maxTreeNodes.toLocaleString()+" values.";
    children.append(notice);
  }
  details.append(children);
  item.append(details);
  return item;
}

function filterEntry(item,query){
  const childItems=[...item.querySelectorAll(":scope > details > ul > li")];
  const childMatches=childItems.map(child=>filterEntry(child,query));
  const ownMatch=item.dataset.searchText.includes(query);
  const matches=ownMatch||childMatches.some(Boolean);
  item.hidden=!matches;
  const details=item.querySelector(":scope > details");
  if(details){
    if(query&&childMatches.some(Boolean))details.open=true;
    if(!query)details.open=details.dataset.initialOpen==="true";
  }
  return matches;
}

function applySearch(){
  const query=searchInput.value.trim().toLocaleLowerCase();
  tree.querySelectorAll(":scope > .json-tree > li").forEach(item=>filterEntry(item,query));
}

function viewJson(){
  updateInputLineNumbers();
  const source=input.value.trim();
  if(!source){
    tree.replaceChildren();
    const placeholder=document.createElement("p");
    placeholder.className="tree-placeholder";
    placeholder.textContent="Paste JSON or open a file, then select View JSON.";
    tree.append(placeholder);
    document.querySelector("#nodeCount").textContent="No data";
    searchInput.disabled=true;
    expandButton.disabled=true;
    collapseButton.disabled=true;
    setStatus("Paste JSON or open a file to begin.");
    return;
  }
  try{
    const value=JSON.parse(source);
    const state={nodes:0,truncated:false};
    const list=document.createElement("ul");
    list.className="json-tree";
    list.append(makeEntry("$",value,0,state));
    tree.replaceChildren(list);
    if(state.truncated){
      const notice=document.createElement("p");
      notice.className="tree-limit";
      notice.textContent="Large JSON tree truncated at "+maxTreeNodes.toLocaleString()+" values.";
      tree.append(notice);
    }
    document.querySelector("#nodeCount").textContent=state.nodes.toLocaleString()+" values";
    searchInput.disabled=false;
    expandButton.disabled=false;
    collapseButton.disabled=false;
    applySearch();
    setStatus(state.truncated?"Valid JSON. Display limited to keep the tree responsive.":"Valid JSON. Expand values to explore the tree.","success");
  }catch(error){
    tree.replaceChildren();
    const placeholder=document.createElement("p");
    placeholder.className="tree-placeholder";
    placeholder.textContent="Enter valid JSON to view its tree.";
    tree.append(placeholder);
    document.querySelector("#nodeCount").textContent="Invalid JSON";
    searchInput.disabled=true;
    expandButton.disabled=true;
    collapseButton.disabled=true;
    setStatus("Invalid JSON: "+error.message,"error");
  }
}

document.querySelector("#viewBtn").addEventListener("click",viewJson);
const fullscreenButton=document.querySelector("#fullscreenBtn");
const viewerTool=document.querySelector(".viewer-tool");
fullscreenButton.addEventListener("click",async()=>{
  try{
    if(document.fullscreenElement===viewerTool)await document.exitFullscreen();
    else await viewerTool.requestFullscreen();
  }catch(error){
    setStatus("Could not change full-screen mode: "+error.message,"error");
  }
});
document.addEventListener("fullscreenchange",()=>{
  const isFullscreen=document.fullscreenElement===viewerTool;
  fullscreenButton.textContent=isFullscreen?"Exit full screen":"Full screen";
  fullscreenButton.setAttribute("aria-label",isFullscreen?"Exit full screen":"Enter full screen");
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  input.value="";
  searchInput.value="";
  viewJson();
  input.focus();
});
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  input.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","validate",{name:"viewer",enabled:true}],private:true},null,2);
  viewJson();
});
document.querySelector("#openFileBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>{
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>maxFileBytes){
    clearViewer("File exceeds the 50 MiB size limit.","error");
    fileInput.value="";
    return;
  }
  if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){
    clearViewer("Please choose a JSON file.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    viewJson();
  };
  reader.onerror=()=>clearViewer("Could not read this file.","error");
  reader.readAsText(file);
});
searchInput.addEventListener("input",setSearch);
expandButton.addEventListener("click",()=>tree.querySelectorAll("details").forEach(item=>item.open=true));
collapseButton.addEventListener("click",()=>tree.querySelectorAll("details").forEach(item=>item.open=false));
input.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter")viewJson();
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
function pathForSegments(segments){
  return segments.reduce((path,segment)=>{
    if(typeof segment==="number")return path+"["+segment+"]";
    return /^[A-Za-z_$][\w$]*$/.test(segment)?path+"."+segment:path+"["+JSON.stringify(segment)+"]";
  },"$");
}

function viewerEntries(value,path){
  if(Array.isArray(value))return value.map((entry,index)=>[index,entry]);
  const stored=keyOrders.get(path)||Object.keys(value);
  const keys=stored.filter(key=>Object.hasOwn(value,key));
  const seen=new Set(keys);
  for(const key of Object.keys(value))if(!seen.has(key)){keys.push(key);seen.add(key)}
  return keys.map(key=>[key,value[key]]);
}

function scanSourceMetadata(source){
  const tokens=new Map(),orders=new Map();
  let index=0;
  const skip=()=>{while(/\s/.test(source[index]||""))index++};
  function readString(){
    const start=index++;
    while(index<source.length){if(source[index]==="\\"){index+=2;continue}if(source[index++]==='"')break}
    return JSON.parse(source.slice(start,index));
  }
  function readValue(segments,depth){
    if(depth>500)throw new RangeError("JSON nesting exceeds the 500-level viewer limit.");
    skip();
    const path=pathForSegments(segments),character=source[index];
    if(character==="{"){
      index++;skip();const keys=[];
      while(source[index]!=="}"){
        const key=readString();keys.push(key);skip();index++;readValue([...segments,key],depth+1);skip();if(source[index]!==",")break;index++;skip();
      }
      index++;orders.set(path,[...new Set(keys)]);
    }else if(character==="["){
      index++;skip();let childIndex=0;
      while(source[index]!=="]"){
        readValue([...segments,childIndex++],depth+1);skip();if(source[index]!==",")break;index++;skip();
      }
      index++;
    }else if(character==='"')readString();
    else if(character==="t")index+=4;
    else if(character==="f")index+=5;
    else if(character==="n")index+=4;
    else{
      const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
      if(!match)throw new Error("Could not preserve a JSON number value.");
      tokens.set(path,match[0]);index+=match[0].length;
    }
  }
  readValue([],0);
  return{tokens,orders};
}

function serializeViewerJson(value,segments=[],indent=2,depth=0,compact=false){
  if(depth>500)throw new RangeError("JSON nesting exceeds the 500-level viewer limit.");
  const path=pathForSegments(segments);
  if(value===null||typeof value!=="object")return typeof value==="number"?(numberTokens.get(path)||JSON.stringify(value)):JSON.stringify(value);
  const entries=viewerEntries(value,path),array=Array.isArray(value);
  if(!entries.length)return array?"[]":"{}";
  const unit=compact?"":" ".repeat(indent),separator=compact?",":",\n",childIndent=compact?"":unit.repeat(depth+1),parentIndent=compact?"":unit.repeat(depth);
  const body=entries.map(([key,item])=>{
    const part=serializeViewerJson(item,[...segments,key],indent,depth+1,compact);
    return array?childIndent+part:childIndent+JSON.stringify(key)+(compact?":":": ")+part;
  }).join(separator);
  return array?"["+(compact?body:"\n"+body+"\n"+parentIndent)+"]":"{"+(compact?body:"\n"+body+"\n"+parentIndent)+"}";
}

function calculateStats(value,source){
  let objects=0,arrays=0,keys=0,primitives=0,maxDepth=0;
  const pending=[{value,depth:0}];
  while(pending.length){
    const current=pending.pop();
    maxDepth=Math.max(maxDepth,current.depth);
    if(Array.isArray(current.value)){
      arrays++;
      for(const child of current.value)pending.push({value:child,depth:current.depth+1});
    }else if(current.value!==null&&typeof current.value==="object"){
      objects++;
      const entries=Object.entries(current.value);keys+=entries.length;
      for(const[,child]of entries)pending.push({value:child,depth:current.depth+1});
    }else primitives++;
  }
  document.querySelector("#inputBytes").textContent=new Blob([source]).size.toLocaleString()+" bytes";
  document.querySelector("#objectCount").textContent=objects.toLocaleString();
  document.querySelector("#arrayCount").textContent=arrays.toLocaleString();
  document.querySelector("#objectKeyCount").textContent=keys.toLocaleString();
  document.querySelector("#primitiveCount").textContent=primitives.toLocaleString();
  document.querySelector("#maxDepth").textContent=maxDepth.toLocaleString();
}

function resetStats(){
  for(const id of ["inputBytes","objectCount","arrayCount","objectKeyCount","primitiveCount","maxDepth"])document.querySelector("#"+id).textContent=id==="inputBytes"?"0 bytes":"0";
}

function highlightText(element,text,query){
  element.replaceChildren();
  if(!query){element.textContent=text;return}
  const lower=text.toLocaleLowerCase(),needle=query.toLocaleLowerCase();
  let offset=0,match=lower.indexOf(needle);
  while(match>=0){
    element.append(document.createTextNode(text.slice(offset,match)));
    const mark=document.createElement("mark");mark.textContent=text.slice(match,match+query.length);element.append(mark);
    offset=match+query.length;match=lower.indexOf(needle,offset);
  }
  element.append(document.createTextNode(text.slice(offset)));
}

function selectNode(item){
  if(currentSelection)currentSelection.classList.remove("selected-node");
  currentSelection=item;
  item.classList.add("selected-node");
  const segments=JSON.parse(item.dataset.segments);
  const value=valueAt(segments);
  document.querySelector("#selectionLabel").textContent=item.dataset.path;
  document.querySelector("#copyPathBtn").disabled=false;
  document.querySelector("#copyKeyBtn").disabled=segments.length===0;
  document.querySelector("#copyValueBtn").disabled=false;
  currentSelection.dataset.copyValue=serializeViewerJson(value,segments,2,0,false);
  currentSelection.dataset.copyKey=segments.length?String(segments[segments.length-1]):"";
}

function valueAt(segments){
  let value=parsedData;
  for(const segment of segments)value=value[segment];
  return value;
}

function primitiveText(value,segments){
  if(typeof value==="number")return numberTokens.get(pathForSegments(segments))||String(value);
  return value===null?"null":typeof value==="string"?JSON.stringify(value):String(value);
}

function makeCopyButton(label,action){
  const button=document.createElement("button");button.type="button";button.className="tree-copy-action";button.textContent=label;button.dataset.copyAction=action;button.setAttribute("aria-label",label);return button;
}

function addTreeEntry(parent,key,value,segments,depth){
  const path=pathForSegments(segments);
  const type=Array.isArray(value)?"array":value===null?"null":typeof value;
  const item=document.createElement("li");item.className="json-tree-entry";item.dataset.path=path;item.dataset.segments=JSON.stringify(segments);item.dataset.kind=type;
  nodeByPath.set(path,item);
  const row=document.createElement("div");row.className="tree-entry-row";
  const composite=type==="object"||type==="array";
  const actions=document.createElement("div");actions.className="tree-entry-actions";actions.append(makeCopyButton("Path","path"),makeCopyButton("Value","value"));
  if(segments.length)actions.append(makeCopyButton("Key","key"));
  if(composite){
    const details=document.createElement("details");details.dataset.path=path;details.open=depth===0;item.append(details);
    const summary=document.createElement("summary");
    const keySpan=document.createElement("span");keySpan.className="tree-key";keySpan.dataset.rawKey=String(key);highlightText(keySpan,String(key),searchInput.value.trim());
    const typeSpan=document.createElement("span");typeSpan.className="tree-kind "+type;typeSpan.textContent=type==="array"?"Array":"Object";
    const countSpan=document.createElement("span");countSpan.className="tree-count";const count=type==="array"?value.length:Object.keys(value).length;countSpan.textContent=count+(type==="array"?(count===1?" item":" items"):(count===1?" key":" keys"));
    summary.append(keySpan,typeSpan,countSpan,actions);summary.addEventListener("click",()=>selectNode(item));details.append(summary);
    const children=document.createElement("ul");children.className="tree-children";details.append(children);item._children=children;item._value=value;item._key=key;item._depth=depth;
    details.addEventListener("toggle",()=>{if(details.open)ensureChildren(item)});
  }else{
    const keySpan=document.createElement("span");keySpan.className="tree-key";keySpan.dataset.rawKey=String(key);highlightText(keySpan,String(key),searchInput.value.trim());
    const typeSpan=document.createElement("span");typeSpan.className="tree-kind "+type;typeSpan.textContent=type;
    const valueSpan=document.createElement("span");valueSpan.className="tree-value "+type;valueSpan.dataset.rawValue=primitiveText(value,segments);highlightText(valueSpan,valueSpan.dataset.rawValue,searchInput.value.trim());
    row.append(keySpan,document.createTextNode(": "),valueSpan,typeSpan,actions);row.addEventListener("click",()=>selectNode(item));item.append(row);
  }
  return item;
}

function entryList(value,path){return Array.isArray(value)?value.map((item,index)=>[index,item]):viewerEntries(value,path)}

function ensureChildren(item){
  if(!item._children||item.dataset.childrenLoaded==="true")return;
  item.dataset.childrenLoaded="true";
  item._entries=entryList(item._value,item.dataset.path);
  item.dataset.loadedCount="0";
  appendNextChildren(item);
}

function updateNodeCount(){
  if(hasParsedData)document.querySelector("#nodeCount").textContent="Loaded "+nodeByPath.size.toLocaleString()+" visible nodes";
}

function appendNextChildren(item,requiredSegment){
  const list=item._children,entries=item._entries||[];
  if(requiredSegment!==undefined){
    const existing=[...list.querySelectorAll(":scope > .json-tree-entry")].find(child=>JSON.parse(child.dataset.segments).at(-1)===requiredSegment);
    if(existing)return existing;
    if(nodeByPath.size>=maxTreeNodes){setStatus("Tree display limit reached at "+maxTreeNodes.toLocaleString()+" values.","error");return null}
    const found=entries.find(([key])=>String(key)===String(requiredSegment));
    if(!found)return null;
    const childSegments=JSON.parse(item.dataset.segments);childSegments.push(Array.isArray(item._value)?Number(requiredSegment):String(requiredSegment));
    const child=addTreeEntry(list,Array.isArray(item._value)?Number(requiredSegment):String(requiredSegment),found[1],childSegments,item._depth+1);list.append(child);updateNodeCount();return child;
  }
  const start=Number(item.dataset.loadedCount||0),target=Math.min(entries.length,start+childPageSize);let index=start;
  for(;index<target&&nodeByPath.size<maxTreeNodes;index++){
    const[key,value]=entries[index],segments=JSON.parse(item.dataset.segments);segments.push(Array.isArray(item._value)?Number(key):String(key));
    list.append(addTreeEntry(list,key,value,segments,item._depth+1));
  }
  item.dataset.loadedCount=String(index);
  const oldMore=list.querySelector(":scope > .tree-load-more");if(oldMore)oldMore.remove();
  if(index<entries.length){const more=document.createElement("li");more.className="tree-load-more";const button=document.createElement("button");button.type="button";button.disabled=nodeByPath.size>=maxTreeNodes;button.textContent=button.disabled?"Tree display limit reached":"Load next "+Math.min(childPageSize,entries.length-index)+" values";button.addEventListener("click",()=>appendNextChildren(item));more.append(button);list.append(more)}
  updateNodeCount();
  return null;
}

function expandAllTree(){
  const root=nodeByPath.get("$");if(!root)return;
  const queue=[root];let cursor=0;
  while(cursor<queue.length&&nodeByPath.size<maxTreeNodes){
    const item=queue[cursor++],details=item.querySelector(":scope > details");
    if(!details)continue;
    details.open=true;ensureChildren(item);
    while(Number(item.dataset.loadedCount||0)<(item._entries||[]).length&&nodeByPath.size<maxTreeNodes)appendNextChildren(item);
    for(const child of item._children.querySelectorAll(":scope > .json-tree-entry"))queue.push(child);
  }
  if(nodeByPath.size>=maxTreeNodes)setStatus("Expanded the first "+maxTreeNodes.toLocaleString()+" values to keep the Viewer responsive.","error");
}

function collapseAllTree(){tree.querySelectorAll("details").forEach(details=>details.open=false)}

function buildTree(){
  tree.replaceChildren();nodeByPath=new Map();currentSelection=null;searchMatches=[];currentMatch=-1;
  const list=document.createElement("ul");list.className="json-tree";
  const root=addTreeEntry(list,"$",parsedData,[],0);list.append(root);tree.append(list);
  if(root.querySelector(":scope > details")){root.querySelector(":scope > details").open=true;ensureChildren(root)}
  updateNodeCount();updateSearchCount();
}

function collectSearchMatches(query){
  const matches=[],needle=query.toLocaleLowerCase(),stack=[{value:parsedData,segments:[]}];
  let visited=0,truncated=false;
  while(stack.length){
    const current=stack.pop();
    if(++visited>maxSearchNodes){truncated=true;break}
    const value=current.value;
    if(value!==null&&typeof value==="object"){
      const entries=entryList(value,pathForSegments(current.segments));
      for(let index=entries.length-1;index>=0;index--){
        const[key,child]=entries[index],segments=[...current.segments,Array.isArray(value)?Number(key):String(key)];
        if(String(key).toLocaleLowerCase().includes(needle))matches.push({segments,path:pathForSegments(segments),kind:"key"});
        if(child===null||typeof child!=="object"){
          const text=typeof child==="number"?(numberTokens.get(pathForSegments(segments))||String(child)):typeof child==="string"?child:String(child);
          if(text.toLocaleLowerCase().includes(needle))matches.push({segments,path:pathForSegments(segments),kind:"value"});
        }else stack.push({value:child,segments});
      }
    }else if(primitiveText(value,current.segments).toLocaleLowerCase().includes(needle))matches.push({segments:current.segments,path:pathForSegments(current.segments),kind:"value"});
  }
  return{matches,truncated};
}

function ensurePath(segments){
  let item=nodeByPath.get("$");
  for(const segment of segments){
    const details=item.querySelector(":scope > details");
    if(details){details.open=true;ensureChildren(item)}
    item=appendNextChildren(item,segment);
    if(!item)return null;
  }
  return item;
}

function updateSearchCount(){
  const count=searchMatches.length;
  document.querySelector("#matchCount").textContent=count?(currentMatch<0?count+" matches":(currentMatch+1)+" of "+count):"0 matches";
  document.querySelector("#previousMatchBtn").disabled=count===0;
  document.querySelector("#nextMatchBtn").disabled=count===0;
}

function applySearch(){
  const query=searchInput.value.trim();
  currentMatch=-1;
  if(!query){searchMatches=[];tree.querySelectorAll("mark").forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent)));updateSearchCount();return}
  const result=collectSearchMatches(query);searchMatches=result.matches;updateSearchCount();
  const rendered=[...tree.querySelectorAll(".tree-key")];
  for(const key of rendered)highlightText(key,key.dataset.rawKey||key.textContent,query);
  for(const value of tree.querySelectorAll(".tree-value"))highlightText(value,value.dataset.rawValue||value.textContent,query);
  if(searchMatches.length)moveToMatch(0);
  setStatus(result.truncated?"Search limited to the first "+maxSearchNodes.toLocaleString()+" values.":searchMatches.length?"Found "+searchMatches.length.toLocaleString()+" matches.":"No matches found.",result.truncated?"error":"success");
}

function moveToMatch(index){
  if(!searchMatches.length)return;
  if(activeMode!=="tree")setMode("tree");
  currentMatch=(index+searchMatches.length)%searchMatches.length;
  const match=searchMatches[currentMatch];
  const item=ensurePath(match.segments);
  if(item){
    tree.querySelectorAll(".match-current").forEach(node=>node.classList.remove("match-current"));
    item.classList.add("match-current");
    item.scrollIntoView({block:"nearest"});
    selectNode(item);
  }
  updateSearchCount();
}

function renderCodeView(){
  const pre=document.querySelector("#jsonCodeView");pre.replaceChildren();
  const text=serializeViewerJson(parsedData,[],2,0,false);
  const tokenPattern=/"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g;
  let offset=0,match;
  while((match=tokenPattern.exec(text))){
    pre.append(document.createTextNode(text.slice(offset,match.index)));
    const token=match[0],span=document.createElement("span");
    span.className=/^"/.test(token)?(/:\s*$/.test(text.slice(match.index+token.length,match.index+token.length+1))?"json-token json-string":"json-token json-string"): /^(true|false|null)$/.test(token)?"json-token json-boolean":/^-?\d/.test(token)?"json-token json-number":"json-token json-punctuation";
    span.textContent=token;pre.append(span);offset=tokenPattern.lastIndex;
  }
  pre.append(document.createTextNode(text.slice(offset)));
}

function setMode(mode){
  activeMode=mode;
  for(const[name,id]of [["tree","treeModeBtn"],["code","codeModeBtn"],["table","tableModeBtn"]]){
    const button=document.querySelector("#"+id),selected=name===mode;button.classList.toggle("active",selected);button.setAttribute("aria-selected",String(selected));
  }
  tree.hidden=mode!=="tree";
  document.querySelector("#jsonCodeView").hidden=mode!=="code";
  document.querySelector("#jsonTableView").hidden=mode!=="table";
  if(mode==="code"&&hasParsedData)renderCodeView();
  if(mode==="table"&&hasParsedData)renderTable();
}

function renderTable(sortKey=tableSort.key,sortDirection=tableSort.direction){
  const container=document.querySelector("#jsonTableView");container.replaceChildren();
  if(!Array.isArray(parsedData)||!parsedData.every(row=>row!==null&&typeof row==="object"&&!Array.isArray(row))){
    const message=document.createElement("p");message.className="tree-placeholder";message.textContent="Table view supports arrays of objects. Choose Tree or Code for this JSON value.";container.append(message);return;
  }
  if(!parsedData.length){const message=document.createElement("p");message.className="tree-placeholder";message.textContent="This array has no records to display.";container.append(message);return}
  const columns=[...new Set(parsedData.flatMap(Object.keys))];
  if(!columns.length){const message=document.createElement("p");message.className="tree-placeholder";message.textContent="Records contain no object keys. Tree or Code view shows the empty objects.";container.append(message);return}
  const wrap=document.createElement("div");wrap.className="viewer-table-scroll";
  const table=document.createElement("table");table.className="viewer-table";
  const head=document.createElement("thead"),filterRow=document.createElement("tr"),labelRow=document.createElement("tr");
  for(const key of columns){
    const th=document.createElement("th"),button=document.createElement("button");button.type="button";button.className="table-sort";button.textContent=key+(sortKey===key?(sortDirection>0?" ↑":" ↓"):" ⇅");button.addEventListener("click",()=>{tableSort={key,direction:tableSort.key===key?-tableSort.direction:1};renderTable(tableSort.key,tableSort.direction)});th.append(button);labelRow.append(th);
    const filterCell=document.createElement("th"),filter=document.createElement("input");filter.type="search";filter.placeholder="Filter";filter.setAttribute("aria-label","Filter "+key);filter.dataset.column=key;filterCell.append(filter);filterRow.append(filterCell);
  }
  head.append(labelRow,filterRow);table.append(head);
  let rows=parsedData.map((row,index)=>({row,index}));
  if(sortKey)rows.sort((left,right)=>{
    const a=left.row[sortKey],b=right.row[sortKey];
    const aText=a&&typeof a==="object"?serializeViewerJson(a,[left.index,sortKey],2,0,false):String(a??"");const bText=b&&typeof b==="object"?serializeViewerJson(b,[right.index,sortKey],2,0,false):String(b??"");
    return aText.localeCompare(bText,undefined,{numeric:true,sensitivity:"base"})*sortDirection;
  });
  const body=document.createElement("tbody");
  for(const{row,index}of rows){
    const tr=document.createElement("tr");tr.dataset.recordIndex=String(index);
    for(const key of columns){const td=document.createElement("td"),value=row[key],segments=[index,key];td.textContent=value===undefined?"—":value!==null&&typeof value==="object"?serializeViewerJson(value,segments,2,0,false):primitiveText(value,segments);td.title=td.textContent;tr.append(td)}
    body.append(tr);
  }
  table.append(body);wrap.append(table);container.append(wrap);
  for(const filter of container.querySelectorAll("thead input"))filter.addEventListener("input",()=>{
    const filters=[...container.querySelectorAll("thead input")].filter(field=>field.value).map(field=>[field.dataset.column,field.value.toLocaleLowerCase()]);
    for(const row of body.rows){const index=Number(row.dataset.recordIndex),source=parsedData[index];row.hidden=!filters.every(([key,text])=>String(source[key]===undefined?"":source[key]!==null&&typeof source[key]==="object"?serializeViewerJson(source[key],[index,key],2,0,false):primitiveText(source[key],[index,key])).toLocaleLowerCase().includes(text))}
  });
}

function viewJson(){
  updateInputLineNumbers();
  const source=input.value;
  if(new Blob([source]).size>maxFileBytes){clearViewer("Input exceeds the 50 MiB size limit.","error");return}
  if(!source.trim()){clearViewer("Paste JSON or open a file, then select View JSON.");return}
  try{
    parsedData=JSON.parse(source);hasParsedData=true;originalSource=source;tableSort={key:"",direction:1};
    const metadata=scanSourceMetadata(source);numberTokens=metadata.tokens;keyOrders=metadata.orders;
    calculateStats(parsedData,source);buildTree();
    searchInput.disabled=false;expandButton.disabled=false;collapseButton.disabled=false;
    document.querySelector("#copyAllBtn").disabled=false;document.querySelector("#downloadBtn").disabled=false;
    setMode(activeMode);document.querySelector("#nodeCount").textContent="Loaded "+Math.min(nodeByPath.size,maxTreeNodes).toLocaleString()+" visible nodes";
    setStatus("Valid JSON. Select a mode to explore the data.","success");
  }catch(error){
    clearViewer(error instanceof SyntaxError?formatParseError(error,source):"Could not display JSON: "+error.message,"error");
  }
}

function formatParseError(error,source){
  const lineColumn=/line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message||"");
  if(lineColumn)return"Invalid JSON at line "+lineColumn[1]+", column "+lineColumn[2]+": "+error.message;
  const position=Number(/position\s+(\d+)/i.exec(error.message||"")?.[1]||source.length),before=source.slice(0,position).split("\n");
  return"Invalid JSON at line "+before.length+", column "+(before.at(-1).length+1)+": "+error.message;
}

function clearViewer(message="Paste JSON or open a file, then select View JSON.",type=""){
  parsedData=undefined;hasParsedData=false;originalSource="";numberTokens=new Map();keyOrders=new Map();nodeByPath=new Map();searchMatches=[];currentMatch=-1;currentSelection=null;
  tree.replaceChildren();const placeholder=document.createElement("p");placeholder.className="tree-placeholder";placeholder.textContent=message;tree.append(placeholder);
  document.querySelector("#nodeCount").textContent=type==="error"?"Unavailable":"No data";
  searchInput.value="";searchInput.disabled=true;expandButton.disabled=true;collapseButton.disabled=true;
  document.querySelector("#previousMatchBtn").disabled=true;document.querySelector("#nextMatchBtn").disabled=true;
  document.querySelector("#copyPathBtn").disabled=true;document.querySelector("#copyKeyBtn").disabled=true;document.querySelector("#copyValueBtn").disabled=true;
  document.querySelector("#copyAllBtn").disabled=true;document.querySelector("#downloadBtn").disabled=true;
  document.querySelector("#selectionLabel").textContent="Select a tree node to copy it.";resetStats();
  document.querySelector("#jsonCodeView").replaceChildren();document.querySelector("#jsonTableView").replaceChildren();setStatus(message,type);
}

function moveToMatch(index){
  if(!searchMatches.length)return;
  currentMatch=(index+searchMatches.length)%searchMatches.length;
  const match=searchMatches[currentMatch],item=ensurePath(match.segments);
  if(item){tree.querySelectorAll(".match-current").forEach(node=>node.classList.remove("match-current"));item.classList.add("match-current");selectNode(item);item.scrollIntoView({block:"nearest"})}
  document.querySelector("#matchCount").textContent=(currentMatch+1)+" of "+searchMatches.length;
}

function copyText(text,label){
  try{navigator.clipboard.writeText(text).then(()=>setStatus(label+" copied to clipboard.","success"),()=>setStatus("Clipboard unavailable. Select and copy manually: "+label,"error"))}
  catch(error){setStatus("Clipboard unavailable. Select and copy manually: "+label,"error")}
}

function openNodePath(path){
  const segments=JSON.parse(tree.querySelector('.json-tree-entry[data-path="'+CSS.escape(path)+'"]')?.dataset.segments||"[]");
  const item=nodeByPath.get(path);if(item)selectNode(item);return segments;
}

function updateVisibleHighlights(query){
  for(const element of tree.querySelectorAll("[data-raw-key]"))highlightText(element,element.dataset.rawKey,query);
  for(const element of tree.querySelectorAll("[data-raw-value]"))highlightText(element,element.dataset.rawValue,query);
}

function setSearch(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    const query=searchInput.value.trim();
    updateVisibleHighlights(query);
    if(!query){searchMatches=[];currentMatch=-1;document.querySelector("#matchCount").textContent="0 matches";setStatus("Search cleared.","success");return}
    const result=collectSearchMatches(query);searchMatches=result.matches;currentMatch=-1;
    document.querySelector("#matchCount").textContent=searchMatches.length+(searchMatches.length===1?" match":" matches")+(result.truncated?" (limit reached)":"");
    document.querySelector("#previousMatchBtn").disabled=searchMatches.length===0;document.querySelector("#nextMatchBtn").disabled=searchMatches.length===0;
    if(searchMatches.length)moveToMatch(0);
    setStatus(result.truncated?"Search stopped at the 100,000-value limit.":searchMatches.length?"Found "+searchMatches.length.toLocaleString()+" matches.":"No matches found.",result.truncated?"error":"success");
  },120);
}

function downloadViewerJson(){
  try{const blob=new Blob([originalSource],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="viewed.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("JSON download started.","success")}
  catch(error){setStatus("Could not create the JSON download.","error")}
}

function attachViewerEnhancements(){
  document.querySelector("#viewBtn").addEventListener("click",viewJson);
  for(const[id,mode]of [["treeModeBtn","tree"],["codeModeBtn","code"],["tableModeBtn","table"]])document.querySelector("#"+id).addEventListener("click",()=>setMode(mode));
  expandButton.addEventListener("click",expandAllTree);
  collapseButton.addEventListener("click",collapseAllTree);
  searchInput.addEventListener("input",setSearch);
  document.querySelector("#previousMatchBtn").addEventListener("click",()=>moveToMatch(currentMatch<=0?searchMatches.length-1:currentMatch-1));
  document.querySelector("#nextMatchBtn").addEventListener("click",()=>moveToMatch(currentMatch+1));
  tree.addEventListener("click",event=>{
    const button=event.target.closest("[data-copy-action]");if(!button)return;
    const item=button.closest(".json-tree-entry");if(!item)return;
    const path=item.dataset.path,segments=JSON.parse(item.dataset.segments),value=valueAt(segments),action=button.dataset.copyAction;
    if(action==="path")copyText(path,"JSONPath");
    else if(action==="key")copyText(String(segments.at(-1)),"Property name");
    else copyText(serializeViewerJson(value,segments,2,0,false),"JSON value");
  });
  document.querySelector("#copyPathBtn").addEventListener("click",()=>{if(currentSelection)copyText(currentSelection.dataset.path,"JSONPath")});
  document.querySelector("#copyKeyBtn").addEventListener("click",()=>{if(currentSelection){const segments=JSON.parse(currentSelection.dataset.segments);if(segments.length)copyText(String(segments.at(-1)),"Property name")}});
  document.querySelector("#copyValueBtn").addEventListener("click",()=>{if(currentSelection){const segments=JSON.parse(currentSelection.dataset.segments);copyText(serializeViewerJson(valueAt(segments),segments,2,0,false),"JSON value")}});
  document.querySelector("#copyAllBtn").addEventListener("click",()=>hasParsedData&&copyText(originalSource,"JSON"));
  document.querySelector("#downloadBtn").addEventListener("click",downloadViewerJson);
  input.addEventListener("input",()=>{updateInputLineNumbers();if(hasParsedData)clearViewer("Input changed. Select View JSON to refresh the result.")});
  const dropPanel=document.querySelector(".viewer-input-panel");
  dropPanel.addEventListener("dragover",event=>{event.preventDefault();dropPanel.classList.add("is-dragging")});
  dropPanel.addEventListener("dragleave",event=>{if(!dropPanel.contains(event.relatedTarget))dropPanel.classList.remove("is-dragging")});
  dropPanel.addEventListener("drop",event=>{
    event.preventDefault();dropPanel.classList.remove("is-dragging");const file=event.dataTransfer.files[0];if(!file){setStatus("Drop a JSON file to load it.","error");return}
    const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}));
  });
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&searchInput.value){searchInput.value="";setSearch();searchInput.focus()}});
}

attachViewerEnhancements();
try{
  const datasetInput=sessionStorage.getItem("romitjson:formatter-input");
  if(datasetInput!==null){
    sessionStorage.removeItem("romitjson:formatter-input");
    input.value=datasetInput;
    viewJson();
  }
}catch(error){
  setStatus("Could not load the prepared dataset from this browser tab: "+error.message,"error");
}
document.querySelector("#year").textContent = new Date().getFullYear();