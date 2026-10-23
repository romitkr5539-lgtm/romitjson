const excelInput = document.querySelector('#jsonInput');
const excelOutput = document.querySelector('#excelOutput');
const excelStatus = document.querySelector('#excelStatus');
const inputSize = document.querySelector('#inputSize');
const excelFileInput = document.querySelector('#fileInput');
const sheetNameInput = document.querySelector('#sheetName');
const fileNameInput = document.querySelector('#fileName');
const includeHeaderCheckbox = document.querySelector('#includeHeader');
const flattenNestedCheckbox = document.querySelector('#flattenNested');
const spreadsheetSafeCheckbox = document.querySelector('#spreadsheetSafe');
const downloadButton = document.querySelector('#downloadBtn');
const copyButton = document.querySelector('#copyBtn');
const rowCount = document.querySelector('#rowCount');
const columnCount = document.querySelector('#columnCount');
const fileSize = document.querySelector('#fileSize');
const excelStats = document.querySelector('#excelStats');
const openFileButton = document.querySelector('#openFileBtn');
let currentWorkbook = null;
let currentWorkbookBlob = null;
let currentPreviewText = '';

function setStatus(text, type = '') {
  excelStatus.textContent = text;
  excelStatus.className = 'formatter-status' + (type ? ' excel-status ' + type : '');
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function textToHeader(path) {
  if (!path.length) return 'value';
  return path
    .map((segment, index) => {
      const part = String(segment);
      if (typeof segment === 'number') return `[${segment}]`;
      if (index === 0) {
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? part : `[${JSON.stringify(part)}]`;
      }
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`;
    })
    .join('')
    .replace(/^\./, '');
}

function flattenObject(record, settings, basePath = []) {
  const flat = {};
  const add = (path, value) => {
    const key = textToHeader(path);
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      let suffix = 2;
      while (Object.prototype.hasOwnProperty.call(flat, `${key}#${suffix}`)) suffix += 1;
      flat[`${key}#${suffix}`] = value;
    } else {
      flat[key] = value;
    }
  };

  for (const [key, value] of Object.entries(record)) {
    const nextPath = [...basePath, key];
    if (value !== null && typeof value === 'object' && settings.flattenNested) {
      if (Array.isArray(value)) {
        add(nextPath, value.map((item) => safeText(item)).join('; '));
      } else {
        Object.assign(flat, flattenObject(value, settings, nextPath));
      }
    } else {
      add(nextPath, value === null || value === undefined ? '' : value);
    }
  }
  return flat;
}

function normalizeValue(value, settings) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return settings.spreadsheetSafe ? value.map((item) => safeText(item)).join('; ') : JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  let text = String(value);
  if (settings.spreadsheetSafe && /^[\s=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function collectTable(data, settings) {
  if (data === null || data === undefined) return { headers: [], rows: [] };

  let rawRows = [];
  if (Array.isArray(data)) {
    if (!data.length) return { headers: [], rows: [] };
    rawRows = data.map((item) => { 
      if (item === null || item === undefined) return {};
      if (Array.isArray(item)) return { value: item };
      if (typeof item === 'object') return item;
      return { value: item };
    });
  } else if (typeof data === 'object') {
    rawRows = [data];
  } else {
    rawRows = [{ value: data }];
  }

  const flattenedRows = rawRows.map((row) => flattenObject(row, settings));
  const headers = [];
  for (const row of flattenedRows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  const rows = flattenedRows.map((row) => headers.map((header) => normalizeValue(row[header], settings)));
  return { headers, rows };
}

function createWorkbookFromData(data, settings) {
  const { headers, rows } = collectTable(data, settings);
  const table = [];
  if (settings.includeHeader && headers.length) table.push(headers);
  for (const row of rows) table.push(row);

  const worksheet = XLSX.utils.aoa_to_sheet(table.length ? table : [['No data']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, settings.sheetName || 'Sheet1');
  return { workbook, headers, rows: table, preview: table };
}

function spreadsheetColumnLabel(index) {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function renderSpreadsheetPreview(rows) {
  const table = document.createElement('table');
  table.className = 'excel-preview-table';
  table.setAttribute('aria-label', 'Converted spreadsheet data');

  const columnCount = Math.max(...rows.map((row) => row.length));
  const columnHeader = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'excel-row-number excel-corner';
  corner.setAttribute('aria-hidden', 'true');
  columnHeader.append(corner);
  for (let column = 0; column < columnCount; column += 1) {
    const heading = document.createElement('th');
    heading.className = 'excel-column-letter';
    heading.scope = 'col';
    heading.textContent = spreadsheetColumnLabel(column);
    columnHeader.append(heading);
  }
  const head = document.createElement('thead');
  head.append(columnHeader);
  table.append(head);

  const body = document.createElement('tbody');
  rows.forEach((row, rowIndex) => {
    const tableRow = document.createElement('tr');
    const rowHeading = document.createElement('th');
    rowHeading.className = 'excel-row-number';
    rowHeading.scope = 'row';
    rowHeading.textContent = String(rowIndex + 1);
    tableRow.append(rowHeading);
    for (let column = 0; column < columnCount; column += 1) {
      const cell = document.createElement('td');
      cell.textContent = row[column] === null || row[column] === undefined ? '' : String(row[column]);
      tableRow.append(cell);
    }
    body.append(tableRow);
  });
  table.append(body);
  excelOutput.replaceChildren(table);
}

function resetOutput() {
  excelOutput.replaceChildren();
  const emptyMessage = document.createElement('p');
  emptyMessage.className = 'excel-empty';
  emptyMessage.textContent = 'Your Excel preview will appear here.';
  excelOutput.append(emptyMessage);
  downloadButton.disabled = true;
  copyButton.disabled = true;
  excelStats.hidden = true;
  currentWorkbook = null;
  currentWorkbookBlob = null;
  currentPreviewText = '';
}

function convert() {
  const source = excelInput.value;
  inputSize.textContent = `${source.length.toLocaleString()} characters`;

  if (!source.trim()) {
    resetOutput();
    setStatus('Paste JSON or open a file to begin.');
    return;
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    resetOutput();
    setStatus(`Invalid JSON: ${error.message}`, 'error');
    return;
  }

  const settings = {
    includeHeader: includeHeaderCheckbox.checked,
    flattenNested: flattenNestedCheckbox.checked,
    spreadsheetSafe: spreadsheetSafeCheckbox.checked,
    sheetName: (sheetNameInput.value || 'Sheet1').trim() || 'Sheet1',
  };

  const { workbook, headers, rows } = createWorkbookFromData(value, settings);
  if (!headers.length) {
    resetOutput();
    setStatus('The JSON structure is empty or does not contain exportable values.', 'error');
    return;
  }

  currentWorkbook = workbook;
  currentPreviewText = rows.map((row) => row.map((cell) => String(cell ?? '')).join('\t')).join('\n');
  renderSpreadsheetPreview(rows);

  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  currentWorkbookBlob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  downloadButton.disabled = false;
  copyButton.disabled = false;
  rowCount.textContent = Math.max(rows.length - (settings.includeHeader ? 1 : 0), 0).toLocaleString();
  columnCount.textContent = headers.length.toLocaleString();
  fileSize.textContent = `${currentWorkbookBlob.size.toLocaleString()} bytes`;
  excelStats.hidden = false;
  setStatus(`Prepared ${Math.max(rows.length - (settings.includeHeader ? 1 : 0), 0)} rows across ${headers.length} columns for Excel.`, 'success');
}

async function copyPreview() {
  if (!currentPreviewText) return;
  try {
    await navigator.clipboard.writeText(currentPreviewText);
    setStatus('Spreadsheet data copied as tab-separated values.', 'success');
  } catch (error) {
    setStatus('Clipboard access failed. You can still copy the text manually.', 'error');
  }
}

function downloadWorkbook() {
  if (!currentWorkbookBlob) return;
  const fileName = `${((fileNameInput.value || 'json-export').trim() || 'json-export').replace(/[^a-z0-9_.-]+/gi, '-').replace(/-+/g, '-').toLowerCase()}.xlsx`;
  const url = URL.createObjectURL(currentWorkbookBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  setStatus(`Downloaded ${fileName}.`, 'success');
}

document.querySelector('#convertBtn').addEventListener('click', convert);
document.querySelector('#clearBtn').addEventListener('click', () => {
  excelInput.value = '';
  inputSize.textContent = '0 characters';
  resetOutput();
  setStatus('Paste JSON or open a file to begin.');
  excelInput.focus();
});
document.querySelector('#sampleBtn').addEventListener('click', () => {
  excelInput.value = JSON.stringify([
    { name: 'Ada Lovelace', role: 'Engineer', active: true, profile: { location: 'London', team: 'Research' }, tags: ['math', 'logic'] },
    { name: 'Grace Hopper', role: 'Computer scientist', active: false, profile: { location: 'Arlington', team: 'Navy' }, tags: ['compiler', 'navy'] },
  ], null, 2);
  convert();
});
document.querySelector('#pasteBtn').addEventListener('click', () => {
  const pasted = window.prompt('Paste JSON to convert to Excel:', excelInput.value || '');
  if (pasted !== null) {
    excelInput.value = pasted;
    convert();
  }
});
if (excelFileInput) {
  excelFileInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      excelInput.value = String(reader.result || '');
      convert();
    };
    reader.readAsText(file);
  });
}
if (openFileButton) openFileButton.addEventListener('click', () => excelFileInput.click());
if (copyButton) copyButton.addEventListener('click', copyPreview);
if (downloadButton) downloadButton.addEventListener('click', downloadWorkbook);
if (excelInput) excelInput.addEventListener('input', () => {
  inputSize.textContent = `${excelInput.value.length.toLocaleString()} characters`;
});
