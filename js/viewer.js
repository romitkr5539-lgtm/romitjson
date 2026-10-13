const input=document.querySelector("#jsonInput");
const tree=document.querySelector("#jsonTree");
const status=document.querySelector("#viewerStatus");
const fileInput=document.querySelector("#fileInput");
const searchInput=document.querySelector("#treeSearch");
const expandButton=document.querySelector("#expandAllBtn");
const collapseButton=document.querySelector("#collapseAllBtn");
const inputLineNumbers=document.querySelector("#inputLineNumbers");
const maxTreeNodes=5000;

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
  if(file.size>10485760){
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    input.value=String(reader.result||"");
    viewJson();
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
});
searchInput.addEventListener("input",applySearch);
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
document.querySelector("#year").textContent=new Date().getFullYear();