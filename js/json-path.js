(() => {
  const jsonInput = document.getElementById('jsonInput');
  const pathInput = document.getElementById('pathInput');
  const findInput = document.getElementById('findInput');
  const resultSummary = document.getElementById('resultSummary');
  const resultList = document.getElementById('resultList');
  const runPathButton = document.getElementById('runPathBtn');
  const runQueryButton = document.getElementById('runQueryBtn');
  const findButton = document.getElementById('findBtn');
  const fileInput = document.getElementById('fileInput');
  const maxInputBytes = 10 * 1024 * 1024;
  const maxResults = 500;
  let JSONPath;
  let engineReady = false;

  function setResult(message, type = '', results = []) {
    resultSummary.textContent = message;
    resultSummary.className = type;
    resultList.replaceChildren();
    for (const result of results.slice(0, maxResults)) {
      const item = document.createElement('li');
      const path = document.createElement('code');
      const value = document.createElement('pre');
      path.textContent = result.path;
      try {
        value.textContent = typeof result.value === 'string'
          ? JSON.stringify(result.value)
          : JSON.stringify(result.value, null, 2);
      } catch (error) {
        value.textContent = `Unable to display this result: ${error.message}`;
      }
      item.append(path, value);
      resultList.appendChild(item);
    }
    if (results.length > maxResults) {
      const item = document.createElement('li');
      item.textContent = `${results.length - maxResults} additional results were omitted.`;
      resultList.appendChild(item);
    }
  }

  async function loadEngine() {
    try {
      const module = await import('https://esm.sh/jsonpath-plus@10.3.0?bundle');
      if (typeof module.JSONPath !== 'function') {
        throw new Error('The JSONPath library loaded in an unsupported format.');
      }
      JSONPath = module.JSONPath;
      engineReady = true;
      runPathButton.disabled = false;
      runQueryButton.disabled = false;
      findButton.disabled = false;
      setResult('Ready. Enter JSON and a JSONPath expression or find text in the document.');
    } catch (error) {
      setResult(`Could not load the JSONPath engine. Check your connection and refresh the page. Details: ${error.message}`, 'error');
    }
  }

  function parseJson() {
    const source = jsonInput.value;
    if (!source.trim()) {
      setResult('Enter JSON data before running a query.');
      return null;
    }
    if (new Blob([source]).size > maxInputBytes) {
      setResult('JSON data must be 10 MiB or smaller.', 'error');
      return null;
    }
    try {
      return JSON.parse(source);
    } catch (error) {
      setResult(`Invalid JSON: ${error.message}`, 'error');
      return null;
    }
  }

  function runQuery() {
    if (!engineReady) {
      setResult('The JSONPath engine is not ready. Check your connection and refresh the page.', 'error');
      return;
    }
    const path = pathInput.value.trim();
    if (!path) {
      setResult('Enter a JSONPath expression to validate and run.', 'error');
      return;
    }
    const data = parseJson();
    if (data === null && jsonInput.value.trim() !== 'null') return;

    try {
      const matches = path === '$'
        ? [{ path: '$', value: data }]
        : JSONPath({
          path,
          json: data,
          resultType: 'all',
          wrap: true,
          eval: 'safe'
        });
      if (!Array.isArray(matches)) {
        throw new Error('The JSONPath engine returned an unexpected result.');
      }
      const results = matches.map((match) => ({
        path: match.path,
        value: match.value
      }));
      const count = results.length;
      setResult(
        count
          ? `Valid JSONPath. Found ${count.toLocaleString()} match${count === 1 ? '' : 'es'}.`
          : 'Valid JSONPath. No matches found.',
        'success',
        results
      );
    } catch (error) {
      setResult(`Invalid JSONPath expression: ${error.message}`, 'error');
    }
  }

  function pathForSegments(segments) {
    if (!segments.length) return '$';
    return '$' + segments.map((segment) => (
      typeof segment === 'number'
        ? `[${segment}]`
        : /^[A-Za-z_$][\w$]*$/.test(segment)
          ? `.${segment}`
          : `[${JSON.stringify(segment)}]`
    )).join('');
  }

  function findPaths() {
    const query = findInput.value.trim().toLocaleLowerCase();
    if (!query) {
      setResult('Enter a key or value to find its JSONPath locations.');
      return;
    }
    const data = parseJson();
    if (data === null && jsonInput.value.trim() !== 'null') return;

    const results = [];
    const seenPaths = new Set();
    const addResult = (segments, value) => {
      const path = pathForSegments(segments);
      if (seenPaths.has(path)) return;
      seenPaths.add(path);
      results.push({ path, value });
    };
    const stack = [{ value: data, segments: [] }];
    while (stack.length) {
      const current = stack.pop();
      const { value, segments } = current;
      if (value !== null && typeof value === 'object') {
        const entries = Array.isArray(value)
          ? value.map((entry, index) => [index, entry])
          : Object.entries(value);
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const [key, child] = entries[index];
          const childSegments = [...segments, key];
          if (typeof key === 'string' && key.toLocaleLowerCase().includes(query)) {
            addResult(childSegments, child);
          }
          if (child !== null && typeof child === 'object') {
            stack.push({ value: child, segments: childSegments });
          } else if (String(child).toLocaleLowerCase().includes(query)) {
            addResult(childSegments, child);
          }
        }
      } else if (String(value).toLocaleLowerCase().includes(query)) {
        addResult(segments, value);
      }
    }
    setResult(
      results.length
        ? `Found ${results.length.toLocaleString()} path match${results.length === 1 ? '' : 'es'}.`
        : 'No keys or values matched that search.',
      results.length ? 'success' : '',
      results
    );
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > maxInputBytes) {
      setResult('File exceeds the 10 MiB limit.', 'error');
      return;
    }
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setResult('Please choose a valid JSON file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      jsonInput.value = typeof reader.result === 'string' ? reader.result : '';
      setResult('JSON file loaded. Run a JSONPath expression or find a key or value.');
    };
    reader.onerror = () => setResult('Could not read the selected JSON file.', 'error');
    reader.readAsText(file);
  }

  document.getElementById('runPathBtn').addEventListener('click', runQuery);
  document.getElementById('runQueryBtn').addEventListener('click', runQuery);
  document.getElementById('findBtn').addEventListener('click', findPaths);
  document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    readFile(fileInput.files[0]);
    fileInput.value = '';
  });
  document.getElementById('sampleBtn').addEventListener('click', () => {
    jsonInput.value = JSON.stringify({
      store: {
        book: [
          { title: 'Sayings of the Century', category: 'reference', price: 8.95 },
          { title: 'Sword of Honour', category: 'fiction', price: 12.99 },
          { title: 'Moby Dick', category: 'fiction', price: 8.99 }
        ],
        location: { city: 'Patna', country: 'India' }
      }
    }, null, 2);
    pathInput.value = '$.store.book[*].title';
    findInput.value = '';
    runQuery();
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    jsonInput.value = '';
    pathInput.value = '$';
    findInput.value = '';
    resultList.replaceChildren();
    setResult(engineReady ? 'Enter JSON data and a JSONPath expression to begin.' : 'Loading JSONPath engine…');
    jsonInput.focus();
  });
  jsonInput.addEventListener('input', () => {
    resultList.replaceChildren();
    setResult('JSON changed. Run the query again to refresh results.');
  });
  pathInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      runQuery();
    }
  });
  findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      findPaths();
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
  const yearLabel = document.getElementById('year');
  if (yearLabel) yearLabel.textContent = String(new Date().getFullYear());
  loadEngine();
})();
