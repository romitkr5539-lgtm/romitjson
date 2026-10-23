(() => {
  const input = document.getElementById('jsonInput');
  const output = document.getElementById('schemaOutput');
  const titleInput = document.getElementById('schemaTitleInput');
  const idInput = document.getElementById('schemaIdInput');
  const additionalCheckbox = document.getElementById('disallowAdditional');
  const fileInput = document.getElementById('fileInput');
  const copyButton = document.getElementById('copyButton');
  const downloadButton = document.getElementById('downloadButton');
  const status = document.getElementById('schemaStatus');
  const stats = document.getElementById('schemaStats');
  const inputSize = document.getElementById('inputSize');
  const maxInputBytes = 10 * 1024 * 1024;
  let generatedSchema = '';

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `formatter-status schema-generator-status${type ? ` ${type}` : ''}`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function highlightJson(json) {
    const tokenPattern = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[{}[\],:]/g;
    let html = '';
    let cursor = 0;
    for (const match of json.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index;
      html += escapeHtml(json.slice(cursor, index));
      let className = 'schema-punctuation';
      if (match[1]) className = 'schema-key';
      else if (match[2]) className = 'schema-string';
      else if (/^-?\d/.test(token)) className = 'schema-number';
      else if (/^(true|false|null)$/.test(token)) className = 'schema-literal';
      html += `<span class="${className}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    return html + escapeHtml(json.slice(cursor));
  }

  function sampleKind(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
  }

  function inferSchema(values, disallowAdditional) {
    const kinds = new Map();
    for (const value of values) {
      const kind = sampleKind(value);
      if (!kinds.has(kind)) kinds.set(kind, []);
      kinds.get(kind).push(value);
    }

    const branches = [];
    const primitiveTypes = [];
    for (const [kind, samples] of kinds) {
      if (kind === 'object') {
        const properties = Object.create(null);
        const keys = new Set(samples.flatMap((sample) => Object.keys(sample)));
        const required = [];
        for (const key of keys) {
          const fieldSamples = [];
          let appearsInEverySample = true;
          for (const sample of samples) {
            if (Object.prototype.hasOwnProperty.call(sample, key)) fieldSamples.push(sample[key]);
            else appearsInEverySample = false;
          }
          properties[key] = inferSchema(fieldSamples, disallowAdditional);
          if (appearsInEverySample) required.push(key);
        }
        const schema = { type: 'object', properties };
        if (required.length) schema.required = required;
        if (disallowAdditional) schema.additionalProperties = false;
        branches.push(schema);
      } else if (kind === 'array') {
        const elements = samples.flat();
        branches.push({
          type: 'array',
          items: elements.length ? inferSchema(elements, disallowAdditional) : {},
        });
      } else if (kind === 'integer' || kind === 'number') {
        primitiveTypes.push(kind);
      } else {
        primitiveTypes.push(kind);
      }
    }

    const uniqueTypes = [...new Set(primitiveTypes)];
    if (uniqueTypes.includes('number') && uniqueTypes.includes('integer')) {
      uniqueTypes.splice(uniqueTypes.indexOf('integer'), 1);
    }
    if (uniqueTypes.length) {
      const primitiveSchema = { type: uniqueTypes.length === 1 ? uniqueTypes[0] : uniqueTypes };
      branches.push(primitiveSchema);
    }

    if (!branches.length) return {};
    if (branches.length === 1) return branches[0];
    return { anyOf: branches };
  }

  function countProperties(schema) {
    let count = schema.properties ? Object.keys(schema.properties).length : 0;
    if (schema.properties) {
      for (const child of Object.values(schema.properties)) count += countProperties(child);
    }
    if (schema.items && schema.items.properties) count += countProperties(schema.items);
    if (schema.anyOf) {
      for (const child of schema.anyOf) count += countProperties(child);
    }
    return count;
  }

  function clearOutput(message = 'Paste JSON or load a sample to begin.') {
    generatedSchema = '';
    output.textContent = 'Generated JSON Schema appears here.';
    copyButton.disabled = true;
    downloadButton.disabled = true;
    stats.hidden = true;
    setStatus(message);
  }

  function generate() {
    const source = input.value;
    inputSize.textContent = `${source.length.toLocaleString()} characters`;
    if (!source.trim()) {
      clearOutput();
      return;
    }
    if (new Blob([source]).size > maxInputBytes) {
      clearOutput('Input JSON must be 10 MiB or smaller.');
      status.classList.add('error');
      return;
    }

    let sample;
    try {
      sample = JSON.parse(source);
    } catch (error) {
      clearOutput(`Invalid JSON: ${error.message}`);
      status.classList.add('error');
      return;
    }

    const title = titleInput.value.trim();
    if (!title) {
      clearOutput('Enter a schema title before generating.');
      status.classList.add('error');
      return;
    }

    try {
      const id = idInput.value.trim();
      if (id) {
        const parsedId = new URL(id);
        if (!['http:', 'https:'].includes(parsedId.protocol)) {
          throw new Error('Schema $id must use an HTTP or HTTPS URL.');
        }
      }
      const rootSchema = inferSchema([sample], additionalCheckbox.checked);
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        ...(id ? { $id: id } : {}),
        title,
        ...rootSchema,
      };
      generatedSchema = JSON.stringify(schema, null, 2);
      output.innerHTML = highlightJson(generatedSchema);
      copyButton.disabled = false;
      downloadButton.disabled = false;
      document.getElementById('rootTypeStat').textContent = rootSchema.type || (rootSchema.anyOf ? 'Union' : 'Any');
      document.getElementById('propertyCountStat').textContent = countProperties(rootSchema).toLocaleString();
      document.getElementById('outputSizeStat').textContent = `${new TextEncoder().encode(generatedSchema).length.toLocaleString()} bytes`;
      stats.hidden = false;
      setStatus('JSON Schema generated. Review inferred required fields and constraints before using it.', 'success');
    } catch (error) {
      clearOutput(`Could not generate the schema: ${error.message}`);
      status.classList.add('error');
    }
  }

  async function copySchema() {
    if (!generatedSchema) return;
    try {
      await navigator.clipboard.writeText(generatedSchema);
      setStatus('JSON Schema copied to clipboard.', 'success');
    } catch {
      setStatus('Clipboard access failed. Select the schema and copy it manually.', 'error');
    }
  }

  function downloadSchema() {
    if (!generatedSchema) return;
    const blob = new Blob([generatedSchema], { type: 'application/schema+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schema.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus('JSON Schema downloaded.', 'success');
  }

  document.getElementById('generateBtn').addEventListener('click', generate);
  document.getElementById('clearBtn').addEventListener('click', () => {
    input.value = '';
    inputSize.textContent = '0 characters';
    clearOutput();
    input.focus();
  });
  document.getElementById('loadSampleBtn').addEventListener('click', () => {
    input.value = JSON.stringify([
      { id: 101, name: 'Ada Lovelace', active: true, profile: { city: 'London', team: 'Research' }, skills: ['math', 'logic'] },
      { id: 202, name: 'Grace Hopper', active: false, profile: { city: 'Arlington', team: 'Navy' }, skills: ['compiler'], nickname: null },
    ], null, 2);
    titleInput.value = 'Person';
    generate();
  });
  document.getElementById('openFileBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > maxInputBytes) {
      clearOutput('Selected file exceeds the 10 MiB limit.');
      status.classList.add('error');
    } else if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      clearOutput('Please choose a JSON file.');
      status.classList.add('error');
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        input.value = typeof reader.result === 'string' ? reader.result : '';
        generate();
      };
      reader.onerror = () => {
        clearOutput('Could not read the selected file.');
        status.classList.add('error');
      };
      reader.readAsText(file);
    }
    fileInput.value = '';
  });
  input.addEventListener('input', () => {
    inputSize.textContent = `${input.value.length.toLocaleString()} characters`;
  });
  copyButton.addEventListener('click', copySchema);
  downloadButton.addEventListener('click', downloadSchema);
  for (const control of [titleInput, idInput, additionalCheckbox]) {
    control.addEventListener('change', () => {
      if (generatedSchema) setStatus('Options changed. Generate again to update the schema.');
    });
  }

  const mainNav = document.getElementById('mainNav');
  const menuButton = document.getElementById('menuBtn');
  menuButton.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
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
