(function () {
const jsonInput = document.getElementById('jsonInput');
const treeOutput = document.getElementById('treeOutput');
const fileInput = document.getElementById('fileInput');
const errorBox = document.getElementById('errorBox');
const selectionLabel = document.getElementById('selectionLabel');
const searchInput = document.getElementById('treeSearch');
const matchCount = document.getElementById('matchCount');
const objectCount = document.getElementById('objectCount');
const arrayCount = document.getElementById('arrayCount');
const depthCount = document.getElementById('depthCount');
const prevMatchBtn = document.getElementById('prevMatchBtn');
const nextMatchBtn = document.getElementById('nextMatchBtn');
const copyPathBtn = document.getElementById('copyPathBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const loadBtn = document.getElementById('loadBtn');
const pasteBtn = document.getElementById('pasteBtn');
const sampleBtn = document.getElementById('sampleBtn');
const openFileBtn = document.getElementById('openFileBtn');
const clearBtn = document.getElementById('clearBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const collapseAllBtn = document.getElementById('collapseAllBtn');
const yearLabel = document.getElementById('year');

let parsedData = null;
let hasParsedData = false;
let currentSelection = null;
let searchMatches = [];
let currentMatchIndex = -1;

const sampleJson = {
  name: 'RomitJSON',
  active: true,
  version: 1.0,
  profile: {
    country: 'India',
    city: 'Patna',
    skills: ['HTML', 'CSS', 'JavaScript'],
    settings: {
      theme: 'dark',
      notifications: true,
      token: null
    }
  },
  projects: [
    {
      name: 'JSON Formatter',
      enabled: true,
      tags: ['format', 'json']
    },
    {
      name: 'JSON Viewer',
      enabled: false,
      tags: ['view', 'debug']
    }
  ],
  metadata: null
};

function setError(message) {
  if (!message) {
    errorBox.hidden = true;
    errorBox.textContent = '';
    return;
  }
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function normalizePathSegment(segment) {
  return typeof segment === 'number' ? `[${segment}]` : ((typeof segment === 'string' && /^[A-Za-z_$][\w$]*$/.test(segment)) ? `.${segment}` : `[${JSON.stringify(segment)}]`);
}

function pathForSegments(segments) {
  if (!segments.length) return '$';
  return '$' + segments.map(normalizePathSegment).join('');
}

function getValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function getPrettyValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return String(value);
}

function getNodePathFromKeyPath(parentPath, keyName) {
  return parentPath === '$' ? `$.${keyName}` : `${parentPath}.${keyName}`;
}

function countSummary(value) {
  if (!value || typeof value !== 'object') return '0';
  const keys = Object.keys(value).length;
  return keys === 1 ? '1 key' : `${keys} keys`;
}

function getDepthStats(data) {
  let maxDepth = 0;
  let objectCount = 0;
  let arrayCount = 0;

  function walk(node, depth) {
    if (node === null || typeof node !== 'object') {
      maxDepth = Math.max(maxDepth, depth);
      return;
    }

    if (Array.isArray(node)) {
      arrayCount += 1;
      maxDepth = Math.max(maxDepth, depth);
      node.forEach((item) => walk(item, depth + 1));
      return;
    }

    objectCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    Object.values(node).forEach((item) => walk(item, depth + 1));
  }

  walk(data, 0);
  return {
    maxDepth: Math.max(0, maxDepth),
    objectCount,
    arrayCount
  };
}

function updateStats() {
  if (!hasParsedData) {
    objectCount.textContent = '0 objects';
    arrayCount.textContent = '0 arrays';
    depthCount.textContent = 'Depth 0';
    return;
  }

  const stats = getDepthStats(parsedData);
  objectCount.textContent = `${stats.objectCount.toLocaleString()} objects`;
  arrayCount.textContent = `${stats.arrayCount.toLocaleString()} arrays`;
  depthCount.textContent = `Depth ${stats.maxDepth}`;
}

function clearHighlights() {
  treeOutput.querySelectorAll('.tree-key-mark, .tree-value-mark').forEach((mark) => {
    const parent = mark.parentNode;
    const text = mark.textContent;
    parent.replaceChild(document.createTextNode(text), mark);
  });
}

function applyHighlight(element, text, query) {
  if (!query) {
    element.textContent = text;
    return;
  }

  const output = document.createDocumentFragment();
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;
  let start = lowerText.indexOf(lowerQuery);

  while (start !== -1) {
    if (start > cursor) {
      output.appendChild(document.createTextNode(text.slice(cursor, start)));
    }

    const mark = document.createElement('mark');
    mark.className = 'tree-value-mark';
    mark.textContent = text.slice(start, start + query.length);
    output.appendChild(mark);

    cursor = start + query.length;
    start = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    output.appendChild(document.createTextNode(text.slice(cursor)));
  }

  element.textContent = '';
  element.appendChild(output);
}

function highlightMatches(query) {
  if (!query) {
    clearHighlights();
    return;
  }

  treeOutput.querySelectorAll('[data-raw-key], [data-raw-value]').forEach((node) => {
    const rawText = node.dataset.rawKey || node.dataset.rawValue || '';
    const fragment = document.createDocumentFragment();
    const lowerText = rawText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let cursor = 0;
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
      if (index > cursor) fragment.appendChild(document.createTextNode(rawText.slice(cursor, index)));
      const mark = document.createElement('mark');
      mark.classList.add(node.dataset.rawKey ? 'tree-key-mark' : 'tree-value-mark');
      mark.textContent = rawText.slice(index, index + query.length);
      fragment.appendChild(mark);
      cursor = index + query.length;
      index = lowerText.indexOf(lowerQuery, cursor);
    }

    if (cursor < rawText.length) fragment.appendChild(document.createTextNode(rawText.slice(cursor)));

    node.textContent = '';
    node.appendChild(fragment);
  });
}

function selectNode(node) {
  if (currentSelection) {
    currentSelection.classList.remove('selected');
  }

  currentSelection = node;
  node.classList.add('selected');
  selectionLabel.textContent = node.dataset.path || '$';
  copyPathBtn.disabled = false;
}

function createPrimitiveLabel(keyName, value, path) {
  const row = document.createElement('div');
  row.className = 'tree-row';
  row.dataset.path = path;

  const keyElement = document.createElement('span');
  keyElement.className = 'tree-key';
  keyElement.dataset.rawKey = String(keyName);
  keyElement.textContent = String(keyName);

  const separator = document.createElement('span');
  separator.className = 'tree-separator';
  separator.textContent = ':';

  const valueElement = document.createElement('span');
  valueElement.className = 'tree-leaf-value tree-value-' + getValueType(value);
  valueElement.dataset.rawValue = getPrettyValue(value);
  valueElement.textContent = getPrettyValue(value);

  row.append(keyElement, separator, valueElement);
  row.addEventListener('click', () => selectNode(row));

  return row;
}

function buildNode(value, keyName, segments, depth) {
  const path = pathForSegments(segments);
  const nodeType = getValueType(value);
  const item = document.createElement('li');
  item.className = 'tree-node';
  item.dataset.path = path;

  if (nodeType === 'object' || nodeType === 'array') {
    const group = document.createElement('details');
    group.className = 'tree-group';
    group.open = depth === 0 || keyName === '$';

    const summary = document.createElement('summary');
    summary.className = 'tree-summary';

    const keyElement = document.createElement('span');
    keyElement.className = `tree-key${path === '$' ? ' root-key' : ''}`;
    keyElement.dataset.rawKey = String(keyName);
    keyElement.textContent = String(keyName);

    const typeBadge = document.createElement('span');
    typeBadge.className = 'tree-kind';
    typeBadge.textContent = nodeType === 'array' ? '[]' : '{}';

    const count = document.createElement('span');
    count.className = 'tree-count';
    const entryCount = nodeType === 'array' ? value.length : Object.keys(value).length;
    count.textContent = `${entryCount} ${nodeType === 'array' ? (entryCount === 1 ? 'item' : 'items') : (entryCount === 1 ? 'key' : 'keys')}`;

    summary.append(keyElement, typeBadge, count);
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      selectNode(item);
    });

    const children = document.createElement('ul');
    children.className = 'tree-children';

    if (nodeType === 'array') {
      value.forEach((entry, index) => {
        const childSegments = [...segments, index];
        const childNode = buildNode(entry, index, childSegments, depth + 1);
        children.appendChild(childNode);
      });
    } else {
      Object.entries(value).forEach(([entryKey, entryValue]) => {
        const childSegments = [...segments, entryKey];
        const childNode = buildNode(entryValue, entryKey, childSegments, depth + 1);
        children.appendChild(childNode);
      });
    }

    if (!value || (nodeType === 'array' && value.length === 0) || (nodeType === 'object' && Object.keys(value).length === 0)) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.textContent = nodeType === 'array' ? '[]' : '{}';
      children.appendChild(empty);
    }

    group.append(summary, children);
    item.appendChild(group);

    item.classList.add('tree-group-node');
    return item;
  }

  const row = createPrimitiveLabel(keyName, value, path);
  item.appendChild(row);
  return item;
}

function renderTree(data) {
  treeOutput.innerHTML = '';
  if (currentSelection) {
    currentSelection.classList.remove('selected');
    currentSelection = null;
  }

  selectionLabel.textContent = 'No node selected';
  copyPathBtn.disabled = true;

  if (!hasParsedData) {
    treeOutput.innerHTML = '<p class="tree-placeholder">No JSON available.</p>';
    return;
  }

  const rootNode = buildNode(data, '$', [], 0);
  const rootList = document.createElement('ul');
  rootList.className = 'tree-root';
  rootList.appendChild(rootNode);
  treeOutput.appendChild(rootList);
}

function parseInput() {
  const text = jsonInput.value;
  if (!text.trim()) {
    parsedData = null;
    hasParsedData = false;
    setError('');
    renderTree(null);
    updateStats();
    clearSearch();
    return;
  }

  try {
    parsedData = JSON.parse(text);
    hasParsedData = true;
    setError('');
    renderTree(parsedData);
    updateStats();
    if (searchInput.value.trim()) {
      runSearch(searchInput.value.trim());
    } else {
      clearSearch();
    }
  } catch (error) {
    parsedData = null;
    hasParsedData = false;
    renderTree(null);
    updateStats();
    clearSearch();
    setError(`Invalid JSON: ${error.message}`);
  }
}

function clearSearch() {
  searchMatches = [];
  currentMatchIndex = -1;
  matchCount.textContent = '0 matches';
  prevMatchBtn.disabled = true;
  nextMatchBtn.disabled = true;
  treeOutput.querySelectorAll('.tree-key-mark, .tree-value-mark').forEach((mark) => {
    const parent = mark.parentNode;
    const text = mark.textContent;
    parent.replaceChild(document.createTextNode(text), mark);
  });
  treeOutput.querySelectorAll('.tree-row, .tree-group').forEach((node) => node.classList.remove('match-target'));
}

function collectMatches(query) {
  const needle = query.toLowerCase();
  const matches = [];

  function walk(value, segments) {
    if (value === null || typeof value !== 'object') {
      const literal = value === null ? 'null' : String(value);
      if (literal.toLowerCase().includes(needle)) {
        matches.push(pathForSegments(segments));
      }
      return;
    }

    const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
    for (const [key, entry] of entries) {
      const nextSegments = [...segments, key];
      if (typeof key === 'string' && key.toLowerCase().includes(needle)) {
        matches.push(pathForSegments(nextSegments));
      }
      walk(entry, nextSegments);
    }
  }

  walk(parsedData, []);
  return matches;
}

function openPath(path) {
  const target = treeOutput.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!target) return;

  let ancestor = target.parentElement;
  while (ancestor && ancestor !== treeOutput) {
    if (ancestor instanceof HTMLDetailsElement) {
      ancestor.open = true;
    }
    ancestor = ancestor.parentElement;
  }

  const ownGroup = target.querySelector('details');
  if (ownGroup) ownGroup.open = true;
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function moveToMatch(offset) {
  if (!searchMatches.length) return;
  currentMatchIndex = (currentMatchIndex + offset + searchMatches.length) % searchMatches.length;
  const path = searchMatches[currentMatchIndex];
  const node = treeOutput.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!node) {
    openPath(path);
    return;
  }

  treeOutput.querySelectorAll('.tree-row, .tree-group-node').forEach((item) => item.classList.remove('match-target'));
  node.classList.add('match-target');
  node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  selectNode(node);
  matchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
}

function runSearch(query) {
  if (!hasParsedData || !query.trim()) {
    clearSearch();
    return;
  }

  searchMatches = [...new Set(collectMatches(query.trim()))];
  if (!searchMatches.length) {
    clearHighlights();
    treeOutput.querySelectorAll('.tree-row, .tree-group-node').forEach((node) => node.classList.remove('match-target'));
    matchCount.textContent = '0 matches';
    prevMatchBtn.disabled = true;
    nextMatchBtn.disabled = true;
    return;
  }

  highlightMatches(query.trim());
  prevMatchBtn.disabled = false;
  nextMatchBtn.disabled = false;

  const firstPath = searchMatches[0];
  openPath(firstPath);
  currentMatchIndex = 0;
  matchCount.textContent = `${searchMatches.length} matches`;
  const target = treeOutput.querySelector(`[data-path="${CSS.escape(firstPath)}"]`);
  if (target) {
    treeOutput.querySelectorAll('.tree-row, .tree-group-node').forEach((node) => node.classList.remove('match-target'));
    target.classList.add('match-target');
  }
}

function copyText(value, label) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    setError(`${label} could not be copied because the clipboard API is unavailable.`);
    return;
  }

  navigator.clipboard.writeText(value)
    .then(() => {
      setError('');
      selectionLabel.textContent = `${label} copied`;
    })
    .catch(() => {
      setError('Clipboard access failed. Please copy the value manually.');
    });
}

function handleCopyJson() {
  if (!hasParsedData) {
    setError('Load valid JSON before copying it.');
    return;
  }
  copyText(JSON.stringify(parsedData, null, 2), 'JSON');
}

function handleCopyPath() {
  if (!currentSelection) {
    setError('Select a node before copying its path.');
    return;
  }
  copyText(currentSelection.dataset.path || '$', 'JSON path');
}

function handlePaste() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    setError('Clipboard reading is unavailable in this browser. Please paste manually.');
    return;
  }

  navigator.clipboard.readText()
    .then((text) => {
      jsonInput.value = text;
      setError('');
      parseInput();
    })
    .catch(() => {
      setError('Could not read clipboard contents. Try pasting manually.');
    });
}

function handleFileRead(file) {
  if (!file) return;
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
    setError('Please select a valid JSON file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    jsonInput.value = typeof reader.result === 'string' ? reader.result : '';
    parseInput();
  };
  reader.onerror = () => setError('The selected JSON file could not be read.');
  reader.readAsText(file);
}

function handleClear() {
  jsonInput.value = '';
  searchInput.value = '';
  parsedData = null;
  hasParsedData = false;
  currentSelection = null;
  searchMatches = [];
  currentMatchIndex = -1;
  clearSearch();
  renderTree(null);
  setError('');
  updateStats();
  selectionLabel.textContent = 'No node selected';
  copyPathBtn.disabled = true;
}

function setupEvents() {
  loadBtn.addEventListener('click', parseInput);
  sampleBtn.addEventListener('click', () => {
    jsonInput.value = JSON.stringify(sampleJson, null, 2);
    parseInput();
  });
  clearBtn.addEventListener('click', handleClear);
  copyJsonBtn.addEventListener('click', handleCopyJson);
  copyPathBtn.addEventListener('click', handleCopyPath);
  pasteBtn.addEventListener('click', handlePaste);
  openFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    handleFileRead(file);
    event.target.value = '';
  });

  searchInput.addEventListener('input', (event) => {
    const query = event.target.value.trim();
    if (!query) {
      clearSearch();
      return;
    }
    runSearch(query);
  });

  prevMatchBtn.addEventListener('click', () => {
    if (!searchMatches.length) return;
    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    const path = searchMatches[currentMatchIndex];
    const target = treeOutput.querySelector(`[data-path="${CSS.escape(path)}"]`);
    if (target) {
      treeOutput.querySelectorAll('.tree-row, .tree-group-node').forEach((node) => node.classList.remove('match-target'));
      target.classList.add('match-target');
      selectNode(target);
      openPath(path);
    }
    matchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
  });

  nextMatchBtn.addEventListener('click', () => {
    if (!searchMatches.length) return;
    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const path = searchMatches[currentMatchIndex];
    const target = treeOutput.querySelector(`[data-path="${CSS.escape(path)}"]`);
    if (target) {
      treeOutput.querySelectorAll('.tree-row, .tree-group-node').forEach((node) => node.classList.remove('match-target'));
      target.classList.add('match-target');
      selectNode(target);
      openPath(path);
    }
    matchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
  });

  expandAllBtn.addEventListener('click', () => {
    treeOutput.querySelectorAll('details').forEach((detail) => { detail.open = true; });
  });

  collapseAllBtn.addEventListener('click', () => {
    treeOutput.querySelectorAll('details').forEach((detail) => { detail.open = false; });
  });

  const menuButton = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');
  if (menuButton && mainNav) {
    menuButton.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
  }

  document.querySelectorAll('.nav-drop-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const dropdown = button.closest('.nav-dropdown');
      const isOpen = dropdown.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

setupEvents();
if (yearLabel) yearLabel.textContent = String(new Date().getFullYear());
updateStats();
clearSearch();
renderTree(null);
})();
