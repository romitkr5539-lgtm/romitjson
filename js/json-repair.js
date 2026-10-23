(() => {
  const input = document.getElementById('jsonInput');
  const output = document.getElementById('jsonOutput');
  const status = document.getElementById('repairStatus');
  const changeList = document.getElementById('changeList');
  const fileInput = document.getElementById('fileInput');
  const repairButton = document.getElementById('repairBtn');
  const copyButton = document.getElementById('copyBtn');
  const downloadButton = document.getElementById('downloadBtn');
  const maxInputBytes = 10 * 1024 * 1024;
  let repairedText = '';

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `repair-status${type ? ` ${type}` : ''}`;
  }

  function resetOutput(message = 'Repaired JSON will appear here.') {
    repairedText = '';
    output.textContent = message;
    copyButton.disabled = true;
    downloadButton.disabled = true;
  }

  function setChanges(changes) {
    changeList.replaceChildren();
    for (const change of changes.length ? changes : ['No repairs performed yet.']) {
      const item = document.createElement('li');
      item.textContent = change;
      changeList.appendChild(item);
    }
  }

  function stripComments(source, changes) {
    let result = '';
    let quote = '';
    let escaped = false;
    let lineComments = 0;
    let blockComments = 0;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      const next = source[index + 1];
      if (quote) {
        result += character;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        result += character;
      } else if (character === '/' && next === '/') {
        lineComments += 1;
        index += 2;
        while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index += 1;
        if (index < source.length) result += source[index];
      } else if (character === '/' && next === '*') {
        blockComments += 1;
        index += 2;
        while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
          if (source[index] === '\n' || source[index] === '\r') result += source[index];
          index += 1;
        }
        if (index < source.length) index += 1;
      } else {
        result += character;
      }
    }
    const count = lineComments + blockComments;
    if (count) changes.push(`Removed ${count} comment${count === 1 ? '' : 's'}.`);
    return result;
  }

  function normalizeSingleQuotes(source, changes) {
    let result = '';
    let converted = 0;
    let inDoubleQuotedString = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (inDoubleQuotedString) {
        result += character;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inDoubleQuotedString = false;
        continue;
      }
      if (character === '"') {
        inDoubleQuotedString = true;
        result += character;
      } else if (character === "'") {
        converted += 1;
        result += '"';
        let closed = false;
        for (index += 1; index < source.length; index += 1) {
          const inner = source[index];
          if (inner === '\\' && index + 1 < source.length) {
            const following = source[index + 1];
            if (following === "'") {
              result += "'";
            } else {
              result += `\\${following === '"' ? '\\"' : following}`;
            }
            index += 1;
          } else if (inner === "'") {
            result += '"';
            closed = true;
            break;
          } else if (inner === '"') {
            result += '\\"';
          } else {
            result += inner;
          }
        }
        if (!closed) result += '';
      } else {
        result += character;
      }
    }
    if (converted) changes.push(`Converted ${converted} single-quoted string${converted === 1 ? '' : 's'} to JSON double quotes.`);
    return result;
  }

  function quoteUnquotedKeys(source, changes) {
    let result = '';
    let quotedKeys = 0;
    for (let index = 0; index < source.length;) {
      const character = source[index];
      if (character === '"') {
        result += character;
        index += 1;
        while (index < source.length) {
          const current = source[index];
          result += current;
          index += 1;
          if (current === '\\' && index < source.length) {
            result += source[index];
            index += 1;
          } else if (current === '"') {
            break;
          }
        }
        continue;
      }
      if (/[A-Za-z_$]/.test(character)) {
        let end = index + 1;
        while (end < source.length && /[A-Za-z0-9_$-]/.test(source[end])) end += 1;
        let lookahead = end;
        while (lookahead < source.length && /\s/.test(source[lookahead])) lookahead += 1;
        if (source[lookahead] === ':') {
          result += `"${source.slice(index, end)}"`;
          quotedKeys += 1;
        } else {
          result += source.slice(index, end);
        }
        index = end;
      } else {
        result += character;
        index += 1;
      }
    }
    if (quotedKeys) changes.push(`Quoted ${quotedKeys} unquoted object key${quotedKeys === 1 ? '' : 's'}.`);
    return result;
  }

  function removeTrailingCommas(source, changes) {
    let result = '';
    let removed = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        result += character;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        result += character;
      } else if (character === ',') {
        let next = index + 1;
        while (next < source.length && /\s/.test(source[next])) next += 1;
        if (source[next] === '}' || source[next] === ']') {
          removed += 1;
        } else {
          result += character;
        }
      } else {
        result += character;
      }
    }
    if (removed) changes.push(`Removed ${removed} trailing comma${removed === 1 ? '' : 's'}.`);
    return result;
  }

  function closeUnmatchedOpeners(source, changes) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (const character of source) {
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') {
        inString = true;
      } else if (character === '{' || character === '[') {
        stack.push(character);
      } else if (character === '}' || character === ']') {
        const expected = character === '}' ? '{' : '[';
        if (stack[stack.length - 1] === expected) stack.pop();
        else return source;
      }
    }
    if (inString || !stack.length) return source;
    const closers = stack.reverse().map((opener) => opener === '{' ? '}' : ']').join('');
    changes.push(`Added missing closing delimiter${closers.length === 1 ? '' : 's'}: ${closers}.`);
    return source + closers;
  }

  function repair() {
    const source = input.value;
    if (!source.trim()) {
      resetOutput();
      setChanges([]);
      setStatus('Paste JSON or open a file to begin.');
      return;
    }
    if (new Blob([source]).size > maxInputBytes) {
      resetOutput('Input exceeds the size limit.');
      setChanges([]);
      setStatus('Input exceeds the 10 MiB size limit.', 'error');
      return;
    }

    const changes = [];
    let candidate = source;
    if (candidate.charCodeAt(0) === 0xFEFF) {
      candidate = candidate.slice(1);
      changes.push('Removed a leading byte-order mark.');
    }
    candidate = stripComments(candidate, changes);
    candidate = normalizeSingleQuotes(candidate, changes);
    candidate = quoteUnquotedKeys(candidate, changes);
    candidate = closeUnmatchedOpeners(candidate, changes);
    candidate = removeTrailingCommas(candidate, changes);

    try {
      const value = JSON.parse(candidate);
      repairedText = JSON.stringify(value, null, 2);
      output.textContent = repairedText;
      copyButton.disabled = false;
      downloadButton.disabled = false;
      setChanges(changes);
      setStatus(
        changes.length
          ? `Repair complete. Applied ${changes.length} type${changes.length === 1 ? '' : 's'} of correction; review the result before using it.`
          : 'Valid JSON. No repair was needed.',
        'success'
      );
    } catch (error) {
      resetOutput('The input could not be repaired automatically.');
      setChanges(changes);
      setStatus(`Could not fully repair JSON: ${error.message}`, 'error');
    }
  }

  function loadFile(file) {
    if (!file) return;
    if (file.size > maxInputBytes) {
      setStatus('File exceeds the 10 MiB size limit.', 'error');
      return;
    }
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setStatus('Please choose a JSON file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      input.value = typeof reader.result === 'string' ? reader.result : '';
      resetOutput();
      setChanges([]);
      setStatus('JSON file loaded. Select Repair JSON to review possible corrections.');
    };
    reader.onerror = () => setStatus('Could not read the selected file.', 'error');
    reader.readAsText(file);
  }

  repairButton.addEventListener('click', repair);
  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      repair();
    }
  });
  input.addEventListener('input', () => {
    resetOutput();
    setChanges([]);
    setStatus(input.value.trim() ? 'Input changed. Repair again to refresh the output.' : 'Paste JSON or open a file to begin.');
  });
  document.getElementById('sampleBtn').addEventListener('click', () => {
    input.value = `{
  // User profile
  user: {
    name: 'Romit',
    active: true,
  },
  skills: ['HTML', 'CSS', 'JavaScript',
`;
    repair();
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    input.value = '';
    resetOutput();
    setChanges([]);
    setStatus('Paste JSON or open a file to begin.');
    input.focus();
  });
  document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    loadFile(fileInput.files[0]);
    fileInput.value = '';
  });
  copyButton.addEventListener('click', async () => {
    if (!repairedText) return;
    try {
      await navigator.clipboard.writeText(repairedText);
      setStatus('Repaired JSON copied to the clipboard.', 'success');
    } catch (error) {
      setStatus(`Could not copy JSON: ${error.message}`, 'error');
    }
  });
  downloadButton.addEventListener('click', () => {
    if (!repairedText) return;
    try {
      const url = URL.createObjectURL(new Blob([repairedText], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'repaired.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Repaired JSON download started.', 'success');
    } catch (error) {
      setStatus(`Could not download JSON: ${error.message}`, 'error');
    }
  });

  const mainNav = document.getElementById('mainNav');
  const menuButton = document.getElementById('menuBtn');
  if (mainNav && menuButton) {
    menuButton.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
  }
  document.querySelectorAll('.nav-drop-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const dropdown = button.closest('.nav-dropdown');
      const isOpen = dropdown.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.nav-dropdown')) return;
    document.querySelectorAll('.nav-dropdown.open').forEach((dropdown) => {
      dropdown.classList.remove('open');
      dropdown.querySelector('.nav-drop-btn').setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('#mainNav a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
