(() => {
  const input = document.getElementById('jsonInput');
  const output = document.getElementById('jsonOutput');
  const status = document.getElementById('prettyStatus');
  const indentSize = document.getElementById('indentSize');
  const fileInput = document.getElementById('fileInput');
  const formatButton = document.getElementById('prettyPrintBtn');
  const copyButton = document.getElementById('copyBtn');
  const downloadButton = document.getElementById('downloadBtn');
  const sampleButton = document.getElementById('sampleBtn');
  const clearButton = document.getElementById('clearBtn');
  const openFileButton = document.getElementById('openFileBtn');
  const yearLabel = document.getElementById('year');
  const maxInputBytes = 50 * 1024 * 1024;
  let formattedText = '';

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `pretty-status${type ? ` ${type}` : ''}`;
  }

  function clearOutput(message = 'Your formatted JSON will appear here.') {
    formattedText = '';
    output.textContent = message;
    copyButton.disabled = true;
    downloadButton.disabled = true;
  }

  function prettyPrint() {
    const source = input.value;
    if (!source.trim()) {
      clearOutput();
      setStatus('Paste JSON or open a file to begin.');
      return;
    }

    if (new Blob([source]).size > maxInputBytes) {
      clearOutput('Input exceeds the size limit.');
      setStatus('Input exceeds the 50 MiB size limit.', 'error');
      return;
    }

    try {
      const value = JSON.parse(source);
      const indentation = indentSize.value === 'tab' ? '\t' : Number(indentSize.value);
      formattedText = JSON.stringify(value, null, indentation);
      output.textContent = formattedText;
      copyButton.disabled = false;
      downloadButton.disabled = false;
      setStatus('Valid JSON. Pretty-printed output is ready.', 'success');
    } catch (error) {
      clearOutput('');
      setStatus(`Invalid JSON: ${error.message}`, 'error');
    }
  }

  function loadFile(file) {
    if (!file) return;
    if (file.size > maxInputBytes) {
      setStatus('File exceeds the 50 MiB size limit.', 'error');
      return;
    }
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setStatus('Please choose a JSON file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      input.value = typeof reader.result === 'string' ? reader.result : '';
      prettyPrint();
    };
    reader.onerror = () => setStatus('Could not read this file.', 'error');
    reader.readAsText(file);
  }

  formatButton.addEventListener('click', prettyPrint);
  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      prettyPrint();
    }
  });
  input.addEventListener('input', () => {
    clearOutput();
    setStatus(input.value.trim() ? 'Input changed. Pretty print again to refresh the output.' : 'Paste JSON or open a file to begin.');
  });
  indentSize.addEventListener('change', () => {
    if (input.value.trim()) prettyPrint();
  });
  sampleButton.addEventListener('click', () => {
    input.value = JSON.stringify({
      user: { id: 42, name: 'Romit', active: true },
      skills: ['HTML', 'CSS', 'JavaScript']
    });
    prettyPrint();
  });
  clearButton.addEventListener('click', () => {
    input.value = '';
    clearOutput();
    setStatus('Paste JSON or open a file to begin.');
    input.focus();
  });
  openFileButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    loadFile(fileInput.files[0]);
    fileInput.value = '';
  });
  copyButton.addEventListener('click', async () => {
    if (!formattedText) return;
    try {
      await navigator.clipboard.writeText(formattedText);
      setStatus('Pretty-printed JSON copied to clipboard.', 'success');
    } catch {
      setStatus('Clipboard access is unavailable in this browser.', 'error');
    }
  });
  downloadButton.addEventListener('click', () => {
    if (!formattedText) return;
    try {
      const url = URL.createObjectURL(new Blob([formattedText], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pretty-printed.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Pretty-printed JSON download started.', 'success');
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

  if (yearLabel) yearLabel.textContent = String(new Date().getFullYear());
})();
