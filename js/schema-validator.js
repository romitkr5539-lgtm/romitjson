(() => {
  const dataInput = document.getElementById('dataInput');
  const schemaInput = document.getElementById('schemaInput');
  const resultSummary = document.getElementById('resultSummary');
  const errorList = document.getElementById('errorList');
  const validateButton = document.getElementById('validateBtn');
  const dataFileInput = document.getElementById('dataFileInput');
  const schemaFileInput = document.getElementById('schemaFileInput');
  const maxFileBytes = 10 * 1024 * 1024;
  const maxReportedErrors = 100;
  let Ajv2020;
  let addFormats;
  let engineReady = false;

  function setResult(message, type = '', errors = []) {
    resultSummary.textContent = message;
    resultSummary.className = type;
    errorList.replaceChildren();
    for (const error of errors.slice(0, maxReportedErrors)) {
      const item = document.createElement('li');
      const instancePath = error.instancePath || '/';
      const schemaPath = error.schemaPath || '(root schema)';
      item.textContent = `${instancePath}: ${error.message} (schema: ${schemaPath})`;
      errorList.appendChild(item);
    }
    if (errors.length > maxReportedErrors) {
      const item = document.createElement('li');
      item.textContent = `${errors.length - maxReportedErrors} additional errors were omitted.`;
      errorList.appendChild(item);
    }
  }

  async function loadEngine() {
    try {
      const [ajvModule, formatsModule] = await Promise.all([
        import('https://esm.sh/ajv@8.17.1/dist/2020?bundle'),
        import('https://esm.sh/ajv-formats@3.0.1?bundle')
      ]);
      Ajv2020 = ajvModule.default;
      addFormats = formatsModule.default;
      if (typeof Ajv2020 !== 'function' || typeof addFormats !== 'function') {
        throw new Error('The JSON Schema validator library loaded in an unsupported format.');
      }
      engineReady = true;
      validateButton.disabled = false;
      setResult('Validator ready. Enter JSON data and a Draft 2020-12 schema.');
    } catch (error) {
      setResult(`Could not load the JSON Schema validator. Check your connection and refresh the page. Details: ${error.message}`, 'error');
    }
  }

  function validate() {
    if (!engineReady) {
      setResult('The validator is not ready. Check your connection and refresh the page.', 'error');
      return;
    }
    const dataText = dataInput.value;
    const schemaText = schemaInput.value;
    if (!dataText.trim() || !schemaText.trim()) {
      setResult('Enter both JSON data and a JSON Schema before validating.', 'error');
      return;
    }
    if (new Blob([dataText]).size > maxFileBytes || new Blob([schemaText]).size > maxFileBytes) {
      setResult('JSON data and schema must each be 10 MiB or smaller.', 'error');
      return;
    }

    let data;
    let schema;
    try {
      data = JSON.parse(dataText);
    } catch (error) {
      setResult(`Invalid JSON data: ${error.message}`, 'error');
      return;
    }
    try {
      schema = JSON.parse(schemaText);
    } catch (error) {
      setResult(`Invalid JSON Schema syntax: ${error.message}`, 'error');
      return;
    }

    try {
      const ajv = new Ajv2020({
        allErrors: true,
        strict: false,
        validateSchema: true,
        validateFormats: true
      });
      addFormats(ajv);
      const validateData = ajv.compile(schema);
      if (validateData(data)) {
        setResult('Valid. The JSON data conforms to the schema.', 'success');
      } else {
        const errors = validateData.errors || [];
        setResult(`Invalid. Found ${errors.length} schema violation${errors.length === 1 ? '' : 's'}.`, 'error', errors);
      }
    } catch (error) {
      setResult(`Could not compile the schema: ${error.message}`, 'error');
    }
  }

  function readJsonFile(file, target, label) {
    if (!file) return;
    if (file.size > maxFileBytes) {
      setResult(`${label} file exceeds the 10 MiB limit.`, 'error');
      return;
    }
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setResult(`Please choose a valid JSON ${label.toLowerCase()} file.`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      target.value = typeof reader.result === 'string' ? reader.result : '';
      setResult(`${label} file loaded. Select Validate JSON to check it.`);
    };
    reader.onerror = () => setResult(`Could not read the ${label.toLowerCase()} file.`, 'error');
    reader.readAsText(file);
  }

  document.getElementById('validateBtn').addEventListener('click', validate);
  document.getElementById('sampleBtn').addEventListener('click', () => {
    dataInput.value = JSON.stringify({
      name: 'RomitJSON',
      email: 'hello@example.com',
      active: true,
      score: 95
    }, null, 2);
    schemaInput.value = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required: ['name', 'email', 'active', 'score'],
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
        active: { type: 'boolean' },
        score: { type: 'integer', minimum: 0, maximum: 100 }
      }
    }, null, 2);
    validate();
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    dataInput.value = '';
    schemaInput.value = '';
    setResult(engineReady ? 'Enter JSON data and a schema to begin.' : 'Loading validator…');
    dataInput.focus();
  });
  document.getElementById('openDataBtn').addEventListener('click', () => dataFileInput.click());
  document.getElementById('openSchemaBtn').addEventListener('click', () => schemaFileInput.click());
  dataFileInput.addEventListener('change', () => {
    readJsonFile(dataFileInput.files[0], dataInput, 'Data');
    dataFileInput.value = '';
  });
  schemaFileInput.addEventListener('change', () => {
    readJsonFile(schemaFileInput.files[0], schemaInput, 'Schema');
    schemaFileInput.value = '';
  });
  for (const input of [dataInput, schemaInput]) {
    input.addEventListener('input', () => {
      if (!engineReady) return;
      setResult('Input changed. Validate again to refresh the result.');
    });
    input.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        validate();
      }
    });
  }

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
  setResult('Loading JSON Schema Draft 2020-12 validator…');
  loadEngine();
})();
