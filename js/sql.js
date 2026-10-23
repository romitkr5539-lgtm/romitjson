(() => {
  const input = document.querySelector('#jsonInput');
  const output = document.querySelector('#sqlOutput');
  const status = document.querySelector('#sqlStatus');
  const fileInput = document.querySelector('#fileInput');
  const tableNameInput = document.querySelector('#tableName');
  const dialectSelect = document.querySelector('#dialectSelect');
  const createTableCheckbox = document.querySelector('#createTable');
  const insertCheckbox = document.querySelector('#insertStatements');
  const flattenCheckbox = document.querySelector('#flattenNested');
  const copyButton = document.querySelector('#copyBtn');
  const downloadButton = document.querySelector('#downloadBtn');
  const stats = document.querySelector('#sqlStats');
  const inputSize = document.querySelector('#inputSize');
  let sqlText = '';

  const dialects = {
    sqlite: { quote: '"', boolType: 'INTEGER', numberType: 'REAL', textType: 'TEXT' },
    mysql: { quote: '`', boolType: 'TINYINT(1)', numberType: 'DOUBLE', textType: 'TEXT' },
    postgresql: { quote: '"', boolType: 'BOOLEAN', numberType: 'DOUBLE PRECISION', textType: 'TEXT' },
  };
  const sqlKeywords = new Set([
    'CREATE', 'TABLE', 'INSERT', 'INTO', 'VALUES', 'NOT', 'NULL', 'PRIMARY', 'KEY',
    'DEFAULT', 'UNIQUE', 'INDEX', 'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'AS',
    'TRUE', 'FALSE',
  ]);
  const sqlTypes = new Set([
    'TEXT', 'INTEGER', 'REAL', 'DOUBLE', 'PRECISION', 'BOOLEAN', 'TINYINT',
  ]);

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `formatter-status sql-status${type ? ` ${type}` : ''}`;
  }

  function quoteIdentifier(identifier, dialect) {
    const quote = dialects[dialect].quote;
    return `${quote}${String(identifier).replaceAll(quote, quote + quote)}${quote}`;
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function colorizeSql(sql) {
    const tokenPattern = /'(?:''|\\.|[^'])*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b|[(),.;]/g;
    let html = '';
    let cursor = 0;
    for (const match of sql.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index;
      html += escapeHtml(sql.slice(cursor, index));
      const upperToken = token.toUpperCase();
      let className = '';
      if (token[0] === "'") className = 'sql-string';
      else if (token[0] === '"' || token[0] === '`') className = 'sql-identifier';
      else if (sqlKeywords.has(upperToken)) className = 'sql-keyword';
      else if (sqlTypes.has(upperToken)) className = 'sql-type';
      else if (/^\d/.test(token)) className = 'sql-number';
      else if (/^[(),.;]$/.test(token)) className = 'sql-punctuation';
      html += className ? `<span class="${className}">${escapeHtml(token)}</span>` : escapeHtml(token);
      cursor = index + token.length;
    }
    return html + escapeHtml(sql.slice(cursor));
  }

  function flattenRecord(record, flattenNested, path = []) {
    const flat = Object.create(null);
    function addValue(key, value) {
      let uniqueKey = key;
      let suffix = 2;
      while (Object.prototype.hasOwnProperty.call(flat, uniqueKey)) {
        uniqueKey = `${key}#${suffix}`;
        suffix += 1;
      }
      flat[uniqueKey] = value;
    }
    for (const [key, value] of Object.entries(record)) {
      const nextPath = [...path, key];
      if (flattenNested && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = flattenRecord(value, flattenNested, nextPath);
        for (const [nestedKey, nestedValue] of Object.entries(nested)) addValue(nestedKey, nestedValue);
      } else {
        addValue(nextPath.join('.'), value);
      }
    }
    return flat;
  }

  function toRecords(data, flattenNested) {
    let records;
    if (Array.isArray(data)) {
      records = data.map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) return item;
        return { value: item };
      });
    } else if (data && typeof data === 'object') {
      records = [data];
    } else {
      records = [{ value: data }];
    }
    return records.map((record) => flattenRecord(record, flattenNested));
  }

  function inferColumnType(values, dialect) {
    const types = new Set();
    for (const value of values) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'boolean') types.add('boolean');
      else if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('A JSON number is outside the supported finite range.');
        types.add(Number.isInteger(value) ? 'integer' : 'number');
      } else types.add('text');
    }
    if (!types.size || types.has('text') || (types.has('boolean') && types.size > 1)) return dialects[dialect].textType;
    if (types.size === 1 && types.has('boolean')) return dialects[dialect].boolType;
    if (types.has('number')) return dialects[dialect].numberType;
    if (types.has('integer')) return 'INTEGER';
    return dialects[dialect].textType;
  }

  function sqlLiteral(value, dialect, columnType) {
    if (value === null || value === undefined) return 'NULL';
    if (columnType === dialects[dialect].textType) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      const escaped = dialect === 'mysql'
        ? text.replace(/\\/g, '\\\\').replace(/'/g, "''")
        : text.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    if (typeof value === 'boolean') {
      if (dialect === 'sqlite') return value ? '1' : '0';
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('A JSON number is outside the supported finite range.');
      return String(value);
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const escaped = dialect === 'mysql'
      ? text.replace(/\\/g, '\\\\').replace(/'/g, "''")
      : text.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  function createSql(data, options) {
    const records = toRecords(data, options.flattenNested);
    const columns = [];
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!columns.includes(key)) columns.push(key);
      }
    }
    if (!columns.length) {
      throw new Error('The JSON structure is empty or does not contain exportable columns.');
    }
    if (!options.createTable && !options.insert) {
      throw new Error('Select CREATE TABLE, INSERT statements, or both.');
    }

    const quote = (identifier) => quoteIdentifier(identifier, options.dialect);
    const columnTypes = new Map(columns.map((column) => [
      column,
      inferColumnType(records.map((record) => record[column]), options.dialect),
    ]));
    const lines = [];
    if (options.createTable) {
      lines.push(`CREATE TABLE ${quote(options.tableName)} (`);
      lines.push(columns.map((column, index) => {
        const comma = index === columns.length - 1 ? '' : ',';
        return `  ${quote(column)} ${columnTypes.get(column)}${comma}`;
      }).join('\n'));
      lines.push(');');
    }
    if (options.insert && records.length) {
      if (lines.length) lines.push('');
      lines.push(`INSERT INTO ${quote(options.tableName)} (${columns.map(quote).join(', ')})`);
      lines.push('VALUES');
      lines.push(records.map((record, index) => {
        const values = columns.map((column) => sqlLiteral(record[column], options.dialect, columnTypes.get(column)));
        return `  (${values.join(', ')})${index === records.length - 1 ? ';' : ','}`;
      }).join('\n'));
    }
    return { sql: lines.join('\n'), columns, rowCount: records.length };
  }

  function resetOutput() {
    sqlText = '';
    output.textContent = 'Your SQL output will appear here.';
    copyButton.disabled = true;
    downloadButton.disabled = true;
    stats.hidden = true;
  }

  function generate() {
    const source = input.value;
    inputSize.textContent = `${source.length.toLocaleString()} characters`;
    if (!source.trim()) {
      resetOutput();
      setStatus('Paste JSON or open a file to begin.');
      return;
    }

    let data;
    try {
      data = JSON.parse(source);
    } catch (error) {
      resetOutput();
      setStatus(`Invalid JSON: ${error.message}`, 'error');
      return;
    }

    const tableName = tableNameInput.value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      resetOutput();
      setStatus('Table name must start with a letter or underscore and contain only letters, numbers, and underscores.', 'error');
      tableNameInput.focus();
      return;
    }

    try {
      const result = createSql(data, {
        dialect: dialectSelect.value,
        tableName,
        createTable: createTableCheckbox.checked,
        insert: insertCheckbox.checked,
        flattenNested: flattenCheckbox.checked,
      });
      sqlText = result.sql;
      output.innerHTML = colorizeSql(sqlText);
      copyButton.disabled = false;
      downloadButton.disabled = false;
      document.querySelector('#rowCount').textContent = result.rowCount.toLocaleString();
      document.querySelector('#columnCount').textContent = result.columns.length.toLocaleString();
      document.querySelector('#sqlSize').textContent = `${new TextEncoder().encode(sqlText).length.toLocaleString()} bytes`;
      stats.hidden = false;
      setStatus(`Generated SQL for ${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'} and ${result.columns.length} ${result.columns.length === 1 ? 'column' : 'columns'}.`, 'success');
    } catch (error) {
      resetOutput();
      setStatus(error.message, 'error');
    }
  }

  async function copySql() {
    if (!sqlText) return;
    try {
      await navigator.clipboard.writeText(sqlText);
      setStatus('SQL copied to clipboard.', 'success');
    } catch (error) {
      setStatus('Clipboard access failed. Select the SQL output and copy it manually.', 'error');
    }
  }

  function downloadSql() {
    if (!sqlText) return;
    const blob = new Blob([sqlText], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'json-to-sql.sql';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus('SQL file downloaded.', 'success');
  }

  document.querySelector('#convertBtn').addEventListener('click', generate);
  document.querySelector('#clearBtn').addEventListener('click', () => {
    input.value = '';
    inputSize.textContent = '0 characters';
    resetOutput();
    setStatus('Paste JSON or open a file to begin.');
    input.focus();
  });
  document.querySelector('#sampleBtn').addEventListener('click', () => {
    input.value = JSON.stringify([
      { name: 'Ada Lovelace', role: 'Engineer', active: true, profile: { city: 'London' } },
      { name: "O'Neil", role: 'Analyst', active: false, profile: { city: 'New York' } },
    ], null, 2);
    generate();
  });
  document.querySelector('#pasteBtn').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setStatus('Clipboard is empty.');
        return;
      }
      input.value = text;
      generate();
    } catch (error) {
      setStatus('Clipboard access failed. Paste JSON directly into the input area.', 'error');
      input.focus();
    }
  });
  document.querySelector('#openFileBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result || '');
      generate();
    };
    reader.onerror = () => setStatus('Could not read this file.', 'error');
    reader.readAsText(file);
    fileInput.value = '';
  });
  input.addEventListener('input', () => {
    inputSize.textContent = `${input.value.length.toLocaleString()} characters`;
  });
  copyButton.addEventListener('click', copySql);
  downloadButton.addEventListener('click', downloadSql);

  document.querySelectorAll('.nav-drop-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = button.parentElement;
      const isOpen = dropdown.classList.toggle('open');
      document.querySelectorAll('.nav-dropdown').forEach((other) => {
        if (other !== dropdown) {
          other.classList.remove('open');
          other.querySelector('.nav-drop-btn').setAttribute('aria-expanded', 'false');
        }
      });
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });
  const menuButton = document.querySelector('#menuBtn');
  const mainNav = document.querySelector('#mainNav');
  menuButton.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#mainNav') && !event.target.closest('#menuBtn')) {
      document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
        dropdown.classList.remove('open');
        dropdown.querySelector('.nav-drop-btn').setAttribute('aria-expanded', 'false');
      });
      mainNav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
  document.querySelector('#year').textContent = new Date().getFullYear();
})();
