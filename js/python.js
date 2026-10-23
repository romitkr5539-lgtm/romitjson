(() => {
  const input = document.querySelector('#jsonInput');
  const output = document.querySelector('#pythonOutput');
  const status = document.querySelector('#pythonStatus');
  const fileInput = document.querySelector('#fileInput');
  const rootNameInput = document.querySelector('#className');
  const styleSelect = document.querySelector('#pythonStyle');
  const includeSampleCheckbox = document.querySelector('#includeSample');
  const optionalFieldsCheckbox = document.querySelector('#optionalFields');
  const copyButton = document.querySelector('#copyButton');
  const downloadButton = document.querySelector('#downloadButton');
  const stats = document.querySelector('#pythonStats');
  const inputSize = document.querySelector('#inputSize');
  let generatedText = '';

  const pythonKeywords = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
    'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
    'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
    'try', 'while', 'with', 'yield',
  ]);

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `formatter-status python-status${type ? ` ${type}` : ''}`;
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

  function colorizePython(code) {
    const tokenPattern = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:from|import|class|def|pass|True|False|None|list|dict|str|int|float|bool|Any|Optional|NotRequired|TypedDict|dataclass)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,:=]/g;
    let html = '';
    let cursor = 0;
    for (const match of code.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index;
      html += escapeHtml(code.slice(cursor, index));
      let className = '';
      if (token.startsWith('"') || token.startsWith("'")) className = 'python-string';
      else if (token.startsWith('#')) className = 'python-comment';
      else if (/^(str|int|float|bool|list|dict|Any|NotRequired|TypedDict)$/.test(token)) className = 'python-type';
      else if (/^\d/.test(token)) className = 'python-number';
      else if (/^[{}()[\].,:=]$/.test(token)) className = 'python-punctuation';
      else className = 'python-keyword';
      html += `<span class="${className}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    return html + escapeHtml(code.slice(cursor));
  }

  function scalar(name, unknown = false) {
    return { kind: 'scalar', name, unknown };
  }

  function object(fields = new Map()) {
    return { kind: 'object', fields };
  }

  function array(element) {
    return { kind: 'array', element };
  }

  function mergeTypes(left, right) {
    if (left.unknown) return { ...right, nullable: left.nullable || right.nullable };
    if (right.unknown) return { ...left, nullable: left.nullable || right.nullable };
    if (left.kind === 'scalar' && left.name === 'None') return { ...right, nullable: true };
    if (right.kind === 'scalar' && right.name === 'None') return { ...left, nullable: true };
    if (left.kind === 'object' && right.kind === 'object') {
      const fields = new Map();
      for (const key of new Set([...left.fields.keys(), ...right.fields.keys()])) {
        const leftType = left.fields.get(key);
        const rightType = right.fields.get(key);
        if (leftType && rightType) fields.set(key, mergeTypes(leftType, rightType));
        else fields.set(key, leftType || rightType);
      }
      return { ...object(fields), nullable: left.nullable || right.nullable };
    }
    if (left.kind === 'array' && right.kind === 'array') {
      return { ...array(mergeTypes(left.element, right.element)), nullable: left.nullable || right.nullable };
    }
    if (left.kind === 'scalar' && right.kind === 'scalar' && left.name === right.name) {
      return { ...left, nullable: left.nullable || right.nullable };
    }
    return { ...scalar('Any'), nullable: left.nullable || right.nullable };
  }

  function inferValue(value) {
    if (value === null) return scalar('None');
    if (typeof value === 'string') return scalar('str');
    if (typeof value === 'boolean') return scalar('bool');
    if (typeof value === 'number') return scalar(Number.isInteger(value) ? 'int' : 'float');
    if (Array.isArray(value)) {
      return array(value.length ? value.map(inferValue).reduce(mergeTypes) : scalar('Any', true));
    }
    const fields = new Map();
    for (const [key, child] of Object.entries(value)) fields.set(key, inferValue(child));
    return object(fields);
  }

  function toTypeName(value) {
    const words = String(value || 'Item').match(/[A-Za-z0-9_]+/g) || [];
    let name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('') || 'Item';
    if (/^\d/.test(name)) name = `Type${name}`;
    if (pythonKeywords.has(name)) name += 'Model';
    return name;
  }

  function toFieldName(value, usedNames) {
    let name = String(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    if (!name) name = 'value';
    if (/^\d/.test(name)) name = `field_${name}`;
    if (pythonKeywords.has(name)) name += '_';
    let uniqueName = name;
    let suffix = 2;
    while (usedNames.has(uniqueName)) uniqueName = `${name}_${suffix++}`;
    usedNames.add(uniqueName);
    return uniqueName;
  }

  function validateRootName(value) {
    const name = String(value || '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || pythonKeywords.has(name)) {
      throw new Error('Root type name must be a valid Python class name and cannot be a Python keyword.');
    }
    return name;
  }

  function buildPython(data, rootName, options) {
    const isRecordArray = Array.isArray(data) && data.length > 0
      && data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
    const rootModel = isRecordArray ? data.map(inferValue).reduce(mergeTypes) : inferValue(data);
    const rootObject = rootModel.kind === 'object'
      ? rootModel
      : object(new Map([['value', rootModel]]));
    const models = [rootObject];
    const names = new Map([[rootObject, rootName]]);
    const fieldsByModel = new Map();
    let hasOptionalType = false;
    let hasAnyType = false;

    function getModelName(model, hint) {
      if (!names.has(model)) {
        const baseName = toTypeName(hint);
        let name = baseName;
        let suffix = 2;
        while ([...names.values()].includes(name)) name = `${baseName}${suffix++}`;
        names.set(model, name);
        models.push(model);
      }
      return names.get(model);
    }

    function renderType(type, hint) {
      let baseType;
      if (type.kind === 'scalar') {
        baseType = type.name === 'None' ? 'Any' : type.name;
        if (baseType === 'Any') hasAnyType = true;
      } else if (type.kind === 'object') {
        baseType = getModelName(type, hint);
      } else if (type.kind === 'array') {
        baseType = `list[${renderType(type.element, `${hint}Item`)}]`;
      } else {
        baseType = 'Any';
        hasAnyType = true;
      }
      if (type.nullable) {
        hasOptionalType = true;
        return `Optional[${baseType}]`;
      }
      return baseType;
    }

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const usedNames = new Set();
      const fields = [...model.fields].map(([key, type]) => ({
        key,
        name: toFieldName(key, usedNames),
        type,
        renderedType: renderType(type, toTypeName(key)),
      }));
      fieldsByModel.set(model, fields);
    }

    const requiredKeys = new Map(models.map((model) => [
      model,
      new Set((fieldsByModel.get(model) || []).map((field) => field.key)),
    ]));

    function inspectSample(value, type) {
      if (type.kind === 'array') {
        if (Array.isArray(value)) value.forEach((item) => inspectSample(item, type.element));
        return;
      }
      if (type.kind !== 'object' || value === null || typeof value !== 'object' || Array.isArray(value)) return;
      for (const field of fieldsByModel.get(type) || []) {
        if (!Object.prototype.hasOwnProperty.call(value, field.key)) requiredKeys.get(type).delete(field.key);
        if (Object.prototype.hasOwnProperty.call(value, field.key)) inspectSample(value[field.key], field.type);
      }
    }

    if (isRecordArray) data.forEach((item) => inspectSample(item, rootObject));
    else if (rootModel.kind === 'object') inspectSample(data, rootObject);

    const style = options.style;
    const declarations = [...models].reverse().map((model) => {
      const name = names.get(model);
      const fields = fieldsByModel.get(model) || [];
      if (style === 'dataclass') {
        const orderedFields = [
          ...fields.filter((field) => requiredKeys.get(model).has(field.key)),
          ...fields.filter((field) => !requiredKeys.get(model).has(field.key)),
        ];
        const lines = orderedFields.map((field) => {
          const isRequired = requiredKeys.get(model).has(field.key);
          const annotation = isRequired || field.renderedType.startsWith('Optional[')
            ? field.renderedType
            : `Optional[${field.renderedType}]`;
          if (!isRequired) hasOptionalType = true;
          return `    ${field.name}: ${annotation}${isRequired ? '' : ' = None'}`;
        });
        return `@dataclass\nclass ${name}:\n${lines.length ? lines.join('\n') : '    pass'}`;
      }
      const lines = fields.map((field) => {
        const isRequired = requiredKeys.get(model).has(field.key);
        const keyType = !isRequired && options.optionalFields
          ? `NotRequired[${field.renderedType}]`
          : field.renderedType;
        return { field, keyType };
      });
      const classSyntaxSafe = fields.every((field) => (
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(field.key) && !pythonKeywords.has(field.key)
      ));
      if (classSyntaxSafe) {
        const classFields = lines.map(({ field, keyType }) => `    ${field.key}: ${keyType}`);
        return `class ${name}(TypedDict):\n${classFields.length ? classFields.join('\n') : '    pass'}`;
      }
      const entries = lines.map(({ field, keyType }) => `        ${JSON.stringify(field.key)}: ${keyType}`);
      return `${name} = TypedDict(\n    ${JSON.stringify(name)},\n    {\n${entries.join(',\n')}${entries.length ? '\n' : ''}    },\n)`;
    });

    const imports = new Set();
    if (style === 'dataclass') imports.add('from dataclasses import dataclass');
    else imports.add('from typing import TypedDict');
    const hasMissingFields = models.some((model) => requiredKeys.get(model).size < fieldsByModel.get(model).length);
    if (style === 'typeddict' && options.optionalFields && hasMissingFields) imports.add('from typing import NotRequired');
    if (hasOptionalType || (style === 'dataclass' && hasMissingFields)) imports.add('from typing import Optional');
    if (hasAnyType) imports.add('from typing import Any');

    function literal(value) {
      if (value === null) return 'None';
      if (typeof value === 'string') return JSON.stringify(value);
      if (typeof value === 'boolean') return value ? 'True' : 'False';
      if (typeof value === 'number') return String(value);
      if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
      if (typeof value === 'object') {
        return `{${Object.entries(value).map(([key, child]) => `${JSON.stringify(key)}: ${literal(child)}`).join(', ')}}`;
      }
      return 'None';
    }

    function dataclassValue(value, type) {
      if (value === null || type.kind === 'scalar') return literal(value);
      if (type.kind === 'array') {
        return `[${value.map((item) => dataclassValue(item, type.element)).join(', ')}]`;
      }
      const fields = fieldsByModel.get(type) || [];
      const argumentsList = fields
        .filter((field) => Object.prototype.hasOwnProperty.call(value, field.key))
        .map((field) => `${field.name}=${dataclassValue(value[field.key], field.type)}`);
      return `${names.get(type)}(${argumentsList.join(', ')})`;
    }

    let sampleCode = '';
    if (options.includeSample) {
      const variableName = rootName.charAt(0).toLowerCase() + rootName.slice(1);
      let sampleValue = literal(data);
      if (style === 'dataclass') {
        if (isRecordArray) {
          sampleValue = `[${data.map((item) => dataclassValue(item, rootObject)).join(', ')}]`;
        } else if (rootModel.kind === 'object') {
          sampleValue = dataclassValue(data, rootObject);
        } else {
          sampleValue = `${rootName}(value=${dataclassValue(data, rootModel)})`;
        }
      }
      sampleCode = `\n\n${variableName} = ${sampleValue}`;
    }

    return {
      code: `${[...imports].join('\n')}\n\n${declarations.join('\n\n')}${sampleCode}`,
      modelCount: models.length,
    };
  }

  function resetOutput() {
    generatedText = '';
    output.textContent = 'Generated Python models appear here.';
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

    let rootName;
    try {
      rootName = validateRootName(rootNameInput.value);
    } catch (error) {
      resetOutput();
      setStatus(error.message, 'error');
      return;
    }

    try {
      const result = buildPython(data, rootName, {
        style: styleSelect.value,
        includeSample: includeSampleCheckbox.checked,
        optionalFields: optionalFieldsCheckbox.checked,
      });
      generatedText = result.code;
      output.innerHTML = colorizePython(generatedText);
      copyButton.disabled = false;
      downloadButton.disabled = false;
      document.querySelector('#rootTypeStat').textContent = rootName;
      document.querySelector('#modelCount').textContent = result.modelCount.toLocaleString();
      document.querySelector('#outputSize').textContent = `${new TextEncoder().encode(generatedText).length.toLocaleString()} bytes`;
      stats.hidden = false;
      setStatus(`Generated ${result.modelCount} Python ${styleSelect.value === 'dataclass' ? 'dataclass' : 'TypedDict'} ${result.modelCount === 1 ? 'type' : 'types'} for ${rootName}.`, 'success');
    } catch (error) {
      resetOutput();
      setStatus(error.message, 'error');
    }
  }

  async function copyPython() {
    if (!generatedText) return;
    try {
      await navigator.clipboard.writeText(generatedText);
      setStatus('Python code copied to clipboard.', 'success');
    } catch (error) {
      setStatus('Clipboard access failed. Select the generated code and copy it manually.', 'error');
    }
  }

  function downloadPython() {
    if (!generatedText) return;
    const blob = new Blob([generatedText], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rootNameInput.value.trim() || 'models'}.py`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus('Python source file downloaded.', 'success');
  }

  function updateOptionalFieldControl() {
    const isTypedDict = styleSelect.value === 'typeddict';
    optionalFieldsCheckbox.disabled = !isTypedDict;
    optionalFieldsCheckbox.closest('.python-check').classList.toggle('is-disabled', !isTypedDict);
  }

  document.querySelector('#generateBtn').addEventListener('click', generate);
  document.querySelector('#clearBtn').addEventListener('click', () => {
    input.value = '';
    inputSize.textContent = '0 characters';
    resetOutput();
    setStatus('Paste JSON or open a file to begin.');
    input.focus();
  });
  document.querySelector('#sampleBtn').addEventListener('click', () => {
    input.value = JSON.stringify([
      { id: 101, name: 'Ada Lovelace', active: true, profile: { city: 'London', team: 'Research' }, skills: ['math', 'logic'] },
      { id: 2147483648, name: 'Grace Hopper', active: false, profile: { city: 'Arlington', team: 'Navy' }, skills: ['compiler'] },
    ], null, 2);
    generate();
  });
  document.querySelector('#pasteBtn').addEventListener('click', () => {
    const pasted = window.prompt('Paste JSON to generate Python models:', input.value || '');
    if (pasted !== null) {
      input.value = pasted;
      generate();
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
  styleSelect.addEventListener('change', updateOptionalFieldControl);
  updateOptionalFieldControl();
  copyButton.addEventListener('click', copyPython);
  downloadButton.addEventListener('click', downloadPython);

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
