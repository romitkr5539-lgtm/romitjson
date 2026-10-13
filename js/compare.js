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
let reportText="";

function setStatus(text,type=""){
  status.textContent=text;
  status.className="formatter-status compare-status"+(type?" "+type:"");
}

function pathForKey(path,key){
  return /^[A-Za-z_$][\w$]*$/.test(key)?path+"."+key:path+"["+JSON.stringify(key)+"]";
}

function addDifference(state,path,kind,left,right){
  if(state.items.length>=maxDifferences){
    state.truncated=true;
    return;
  }
  state.items.push({path,kind,left,right});
}

function collectDifferences(left,right,path,state){
  if(state.items.length>=maxDifferences){
    state.truncated=true;
    return;
  }
  if(left===right)return;
  const leftArray=Array.isArray(left);
  const rightArray=Array.isArray(right);
  const leftObject=left!==null&&typeof left==="object";
  const rightObject=right!==null&&typeof right==="object";
  if(leftObject!==rightObject||leftArray!==rightArray||left===null||right===null){
    addDifference(state,path,"changed",left,right);
    return;
  }
  if(leftArray){
    const length=Math.max(left.length,right.length);
    for(let index=0;index<length&&state.items.length<maxDifferences;index++){
      const childPath=path+"["+index+"]";
      if(index>=left.length)addDifference(state,childPath,"added",undefined,right[index]);
      else if(index>=right.length)addDifference(state,childPath,"removed",left[index],undefined);
      else collectDifferences(left[index],right[index],childPath,state);
    }
    if(length>maxDifferences)state.truncated=true;
    return;
  }
  if(leftObject){
    const keys=new Set([...Object.keys(left),...Object.keys(right)]);
    for(const key of keys){
      if(state.items.length>=maxDifferences){
        state.truncated=true;
        break;
      }
      const childPath=pathForKey(path,key);
      if(!Object.hasOwn(left,key))addDifference(state,childPath,"added",undefined,right[key]);
      else if(!Object.hasOwn(right,key))addDifference(state,childPath,"removed",left[key],undefined);
      else collectDifferences(left[key],right[key],childPath,state);
    }
    return;
  }
  addDifference(state,path,"changed",left,right);
}

function valueText(value){
  return value===undefined?"—":JSON.stringify(value);
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

function renderDifferences(items){
  const fragment=document.createDocumentFragment();
  reportText=items.map(item=>item.kind.toUpperCase()+" "+item.path+"\n  JSON A: "+valueText(item.left)+"\n  JSON B: "+valueText(item.right)).join("\n\n");
  for(const item of items){
    const row=document.createElement("article");
    row.className="difference-row";
    const heading=document.createElement("div");
    heading.className="difference-heading";
    const path=document.createElement("code");
    path.className="difference-path";
    path.textContent=item.path;
    const kind=document.createElement("span");
    kind.className="difference-kind "+item.kind;
    kind.textContent=item.kind;
    heading.append(path,kind);
    row.append(heading);
    addValueCell(row,"JSON A",item.left);
    addValueCell(row,"JSON B",item.right);
    fragment.append(row);
  }
  differenceList.replaceChildren(fragment);
}

function clearReport(){
  reportText="";
  differenceList.replaceChildren();
  copyButton.disabled=true;
  countLabel.textContent="No comparison yet";
  summary.className="compare-summary";
  summary.textContent="Add two JSON documents and compare them.";
}

function compareJson(){
  summary.className="compare-summary";
  let left;
  let right;
  try{
    if(!firstInput.value.trim())throw new Error("JSON A is empty.");
    left=JSON.parse(firstInput.value);
  }catch(error){
    clearReport();
    summary.textContent=error.message;
    summary.classList.add("error");
    setStatus("Could not compare JSON A: "+error.message,"error");
    return;
  }
  try{
    if(!secondInput.value.trim())throw new Error("JSON B is empty.");
    right=JSON.parse(secondInput.value);
  }catch(error){
    clearReport();
    summary.textContent=error.message;
    summary.classList.add("error");
    setStatus("Could not compare JSON B: "+error.message,"error");
    return;
  }
  const state={items:[],truncated:false};
  collectDifferences(left,right,"$",state);
  renderDifferences(state.items);
  if(!state.items.length){
    summary.textContent="These documents contain the same JSON data.";
    summary.classList.add("match");
    countLabel.textContent="No differences";
    reportText="No differences found.";
  }else{
    summary.textContent=state.truncated?"Showing the first "+maxDifferences.toLocaleString()+" differences.":"Found "+state.items.length.toLocaleString()+(state.items.length===1?" difference.":" differences.");
    countLabel.textContent=state.items.length.toLocaleString()+(state.items.length===1?" difference":" differences");
  }
  copyButton.disabled=false;
  setStatus("Comparison complete. Your original documents were not changed.","success");
  document.querySelector("#resultsTitle").scrollIntoView({behavior:"smooth",block:"start"});
}

document.querySelector("#compareBtn").addEventListener("click",compareJson);
document.querySelector("#sampleBtn").addEventListener("click",()=>{
  firstInput.value=JSON.stringify({name:"RomitJSON",version:"1.0",tools:["format","validate"],private:true},null,2);
  secondInput.value=JSON.stringify({name:"RomitJSON",version:"1.1",tools:["format","validate","compare"],private:true},null,2);
  document.querySelector("#firstSize").textContent=firstInput.value.length.toLocaleString()+" characters";
  document.querySelector("#secondSize").textContent=secondInput.value.length.toLocaleString()+" characters";
  compareJson();
});
document.querySelector("#clearBtn").addEventListener("click",()=>{
  firstInput.value="";
  secondInput.value="";
  firstFile.value="";
  secondFile.value="";
  document.querySelector("#firstSize").textContent="0 characters";
  document.querySelector("#secondSize").textContent="0 characters";
  clearReport();
  setStatus("Your documents stay in this browser.");
  firstInput.focus();
});
function openJsonFile(fileInput,target,sizeLabel){
  const file=fileInput.files[0];
  if(!file)return;
  if(file.size>10485760){
    setStatus("File exceeds the 10MB limit.","error");
    fileInput.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    target.value=String(reader.result||"");
    sizeLabel.textContent=target.value.length.toLocaleString()+" characters";
    clearReport();
    setStatus(file.name+" loaded. Compare when both documents are ready.");
  };
  reader.onerror=()=>setStatus("Could not read this file.","error");
  reader.readAsText(file);
}
document.querySelector("#openFirstBtn").addEventListener("click",()=>firstFile.click());
document.querySelector("#openSecondBtn").addEventListener("click",()=>secondFile.click());
firstFile.addEventListener("change",()=>openJsonFile(firstFile,firstInput,document.querySelector("#firstSize")));
secondFile.addEventListener("change",()=>openJsonFile(secondFile,secondInput,document.querySelector("#secondSize")));
for(const[inputElement,sizeLabel]of [[firstInput,document.querySelector("#firstSize")],[secondInput,document.querySelector("#secondSize")]]){
  inputElement.addEventListener("input",()=>{
    sizeLabel.textContent=inputElement.value.length.toLocaleString()+" characters";
    clearReport();
    setStatus("Input changed. Compare again to update the results.");
  });
  inputElement.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==="Enter")compareJson();
  });
}
copyButton.addEventListener("click",async()=>{
  if(!reportText)return;
  try{
    await navigator.clipboard.writeText(reportText);
    setStatus("Comparison report copied to clipboard.","success");
  }catch{
    setStatus("Clipboard access is unavailable in this browser.","error");
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
document.querySelectorAll("#mainNav a").forEach(link=>link.addEventListener("click",()=>{
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
}));
document.querySelector("#year").textContent=new Date().getFullYear();