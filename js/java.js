(() => {
  const input = document.querySelector('#jsonInput');
  const output = document.querySelector('#javaOutput');
  const status = document.querySelector('#javaStatus');
  const fileInput = document.querySelector('#fileInput');
  const classNameInput = document.querySelector('#className');
  const javaStyleSelect = document.querySelector('#javaStyle');
  const packageNameInput = document.querySelector('#packageName');
  const includeSampleCheckbox = document.querySelector('#includeSample');
  const jacksonCheckbox = document.querySelector('#jacksonAnnotations');
  const bigDecimalCheckbox = document.querySelector('#useBigDecimal');
  const copyButton = document.querySelector('#copyButton');
  const downloadButton = document.querySelector('#downloadButton');
  const stats = document.querySelector('#javaStats');
  const inputSize = document.querySelector('#inputSize');
  let generatedText = '';

  const javaKeywords = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
    'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int',
    'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
    'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false',
    'null', '_', 'var', 'record', 'sealed', 'permits', 'yield',
  ]);

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `formatter-status java-status${type ? ` ${type}` : ''}`;
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

  function colorizeJava(code) {
    const tokenPattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:package|import|public|private|protected|static|class|record|new|return|this|final|extends|implements|true|false|null|int|long|boolean|double)\b|\b(?:String|Boolean|Integer|Long|Double|Object|List|BigDecimal)\b|\b\d+(?:\.\d+)?[fFdDlL]?\b|[{}()[\].;,<>@=]/g;
    let html = '';
    let cursor = 0;
    for (const match of code.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index;
      html += escapeHtml(code.slice(cursor, index));
      let className = '';
      if (token.startsWith('"') || token.startsWith("'")) className = 'java-string';
      else if (token.startsWith('//') || token.startsWith('/*')) className = 'java-comment';
      else if (/^(String|Boolean|Integer|Long|Double|Object|List|BigDecimal|int|long|boolean|double)$/.test(token)) className = 'java-type';
      else if (/^\d/.test(token)) className = 'java-number';
      else if (/^[{}()[\].;,<>@=]$/.test(token)) className = 'java-punctuation';
      else className = 'java-keyword';
      html += `<span class="${className}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    return html + escapeHtml(code.slice(cursor));
  }

  function scalarType(name) {
    return { kind: 'scalar', name };
  }

  function objectType(fields = new Map()) {
    return { kind: 'object', fields };
  }

  function arrayType(element) {
    return { kind: 'array', element };
  }

  function mergeTypes(left, right) {
    if (left.kind === 'scalar' && left.name === 'unknown') return right;
    if (right.kind === 'scalar' && right.name === 'unknown') return left;
    if (left.kind === 'scalar' && left.name === 'null') return right;
    if (right.kind === 'scalar' && right.name === 'null') return left;
    const numericTypes = new Set(['Integer', 'Long', 'Double', 'BigDecimal']);
    if (left.kind === 'scalar' && right.kind === 'scalar'
      && numericTypes.has(left.name) && numericTypes.has(right.name)) {
      if (left.name === 'BigDecimal' || right.name === 'BigDecimal') return scalarType('BigDecimal');
      if (left.name === 'Double' || right.name === 'Double') return scalarType('Double');
      if (left.name === 'Long' || right.name === 'Long') return scalarType('Long');
      return scalarType('Integer');
    }
    if (left.kind === 'object' && right.kind === 'object') {
      const fields = new Map();
      for (const key of new Set([...left.fields.keys(), ...right.fields.keys()])) {
        const leftField = left.fields.get(key);
        const rightField = right.fields.get(key);
        if (leftField && rightField) fields.set(key, mergeTypes(leftField, rightField));
        else fields.set(key, (leftField || rightField));
      }
      return objectType(fields);
    }
    if (left.kind === 'array' && right.kind === 'array') {
      return arrayType(mergeTypes(left.element, right.element));
    }
    if (left.kind === 'scalar' && right.kind === 'scalar' && left.name === right.name) return left;
    return scalarType('Object');
  }

  function inferValue(value) {
    if (value === null) return scalarType('null');
    if (typeof value === 'string') return scalarType('String');
    if (typeof value === 'boolean') return scalarType('Boolean');
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('A JSON number is outside the supported finite range.');
      if (Number.isInteger(value)) {
        return scalarType(Number.isSafeInteger(value) && value >= -2147483648 && value <= 2147483647 ? 'Integer' : 'Long');
      }
      return scalarType(bigDecimalCheckbox.checked ? 'BigDecimal' : 'Double');
    }
    if (Array.isArray(value)) {
      return arrayType(value.length ? value.map(inferValue).reduce(mergeTypes) : scalarType('unknown'));
    }
    const fields = new Map();
    for (const [key, child] of Object.entries(value)) fields.set(key, inferValue(child));
    return objectType(fields);
  }

  function validClassName(name, label) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || javaKeywords.has(name)) {
      throw new Error(`${label} must be a valid Java identifier and cannot be a Java keyword.`);
    }
    return name;
  }

  function toClassName(hint) {
    const words = String(hint || 'Item').match(/[A-Za-z0-9_$]+/g) || [];
    let name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('') || 'Item';
    if (/^\d/.test(name)) name = `Type${name}`;
    if (javaKeywords.has(name)) name += 'Model';
    return name;
  }

  function toFieldName(key) {
    let name = String(key)
      .replace(/[^A-Za-z0-9_$]+(.)?/g, (_, next) => next ? next.toUpperCase() : '')
      .replace(/^[^A-Za-z_$]+/, '');
    if (!name) name = 'value';
    if (/^\d/.test(name)) name = `field${name}`;
    if (javaKeywords.has(name)) name += 'Value';
    return name;
  }

  function propertyName(key, usedNames) {
    const baseName = toFieldName(key);
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) name = `${baseName}${suffix++}`;
    usedNames.add(name);
    return name;
  }

  function validatePackage(value) {
    const packageName = value.trim();
    if (!packageName) return '';
    const parts = packageName.split('.');
    if (parts.some((part) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) || javaKeywords.has(part))) {
      throw new Error('Package name must contain valid Java identifiers separated by dots.');
    }
    return packageName;
  }

  function buildClassJava(data, rootName, packageName) {
    const rootModel = Array.isArray(data) && data.length > 0
      && data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
      ? data.map(inferValue).reduce(mergeTypes)
      : inferValue(data);
    const rootFields = rootModel.kind === 'object'
      ? rootModel
      : objectType(new Map([['value', rootModel]]));
    const allocatedNames = new Set([rootName]);
    const namesByObject = new Map([[rootFields, rootName]]);
    const classQueue = [{ model: rootFields, name: rootName, isRoot: true }];
    const nestedClasses = [];
    let rootProperties = '';
    let hasList = false;
    let hasBigDecimal = false;

    function allocateClassName(hint) {
      const baseName = toClassName(hint);
      let name = baseName;
      let suffix = 2;
      while (allocatedNames.has(name)) name = `${baseName}${suffix++}`;
      allocatedNames.add(name);
      return name;
    }

    function renderType(type, hint) {
      if (type.kind === 'scalar') {
        if (type.name === 'null' || type.name === 'unknown') return 'Object';
        if (type.name === 'BigDecimal') hasBigDecimal = true;
        return type.name;
      }
      if (type.kind === 'object') {
        if (!namesByObject.has(type)) {
          const name = allocateClassName(hint);
          namesByObject.set(type, name);
          classQueue.push({ model: type, name, isRoot: false });
        }
        return namesByObject.get(type);
      }
      if (type.kind === 'array') {
        hasList = true;
        return `List<${renderType(type.element, `${hint}Item`)}>`;
      }
      return 'Object';
    }

    for (let queueIndex = 0; queueIndex < classQueue.length; queueIndex += 1) {
      const { model, name, isRoot } = classQueue[queueIndex];
      const usedFieldNames = new Set();
      const fields = [];
      for (const [key, type] of model.fields) {
        const fieldName = propertyName(key, usedFieldNames);
        const fieldType = renderType(type, toClassName(key));
        const annotation = jacksonCheckbox.checked && key !== fieldName
          ? `  @JsonProperty(${JSON.stringify(key)})\n`
          : '';
        fields.push(`${annotation}  public ${fieldType} ${fieldName};`);
      }
      const classPrefix = isRoot ? 'public class' : 'public static class';
      if (isRoot) rootProperties = fields.join('\n');
      else {
        const nestedFields = fields.map((field) => `  ${field}`).join('\n');
        nestedClasses.push(`  ${classPrefix} ${name} {\n${nestedFields}\n  }`);
      }
    }

    const imports = [];
    if (hasList) imports.push('import java.util.List;');
    if (hasBigDecimal) imports.push('import java.math.BigDecimal;');
    if (jacksonCheckbox.checked && [rootProperties, ...nestedClasses].some((body) => body.includes('@JsonProperty('))) {
      imports.push('import com.fasterxml.jackson.annotation.JsonProperty;');
    }
    const classBody = `public class ${rootName} {\n${rootProperties}${nestedClasses.length ? `\n\n${nestedClasses.join('\n\n')}` : ''}\n}`;
    const parts = [];
    if (packageName) parts.push(`package ${packageName};`);
    if (imports.length) parts.push(imports.join('\n'));
    parts.push(classBody);
    return { code: parts.join('\n\n'), classCount: nestedClasses.length + 1, typeLabel: 'class' };
  }

  function buildRecordJava(data, rootName, packageName) {
    const isRecordArray = Array.isArray(data) && data.length > 0
      && data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
    const rootModel = isRecordArray ? data.map(inferValue).reduce(mergeTypes) : inferValue(data);
    const rootFields = rootModel.kind === 'object'
      ? rootModel
      : objectType(new Map([['value', rootModel]]));
    const allocatedNames = new Set([rootName]);
    const namesByObject = new Map([[rootFields, rootName]]);
    const modelQueue = [rootFields];
    const modelNames = new Map([[rootFields, rootName]]);
    const modelFields = new Map();
    const requiredFields = new Map();
    let hasList = false;
    let hasBigDecimal = false;

    function allocateRecordName(hint) {
      const baseName = toClassName(hint);
      let name = baseName;
      let suffix = 2;
      while (allocatedNames.has(name)) name = `${baseName}${suffix++}`;
      allocatedNames.add(name);
      return name;
    }

    function renderType(type, hint) {
      if (type.kind === 'scalar') {
        if (type.name === 'null' || type.name === 'unknown') return 'Object';
        if (type.name === 'BigDecimal') hasBigDecimal = true;
        return type.name;
      }
      if (type.kind === 'object') {
        if (!namesByObject.has(type)) {
          const name = allocateRecordName(hint);
          namesByObject.set(type, name);
          modelNames.set(type, name);
          modelQueue.push(type);
        }
        return namesByObject.get(type);
      }
      if (type.kind === 'array') {
        hasList = true;
        return `List<${renderType(type.element, `${hint}Item`)}>`;
      }
      return 'Object';
    }

    for (let modelIndex = 0; modelIndex < modelQueue.length; modelIndex += 1) {
      const model = modelQueue[modelIndex];
      const usedFieldNames = new Set();
      const fields = [];
      for (const [key, type] of model.fields) {
        const fieldName = propertyName(key, usedFieldNames);
        const fieldType = renderType(type, toClassName(key));
        const annotation = jacksonCheckbox.checked && key !== fieldName
          ? `@JsonProperty(${JSON.stringify(key)}) `
          : '';
        fields.push({ key, fieldName, fieldType, type, annotation });
      }
      modelFields.set(model, fields);
      requiredFields.set(model, new Set(fields.map((field) => field.key)));
    }

    function inspectSample(value, type) {
      if (type.kind === 'array') {
        if (Array.isArray(value)) value.forEach((item) => inspectSample(item, type.element));
        return;
      }
      if (type.kind !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return;
      const fields = modelFields.get(type) || [];
      const required = requiredFields.get(type);
      for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(value, field.key) || value[field.key] === null) {
          required.delete(field.key);
        }
        if (Object.prototype.hasOwnProperty.call(value, field.key)) inspectSample(value[field.key], field.type);
      }
    }

    if (isRecordArray) data.forEach((item) => inspectSample(item, rootFields));
    else if (rootModel.kind === 'object') inspectSample(data, rootFields);
    else inspectSample(data, rootModel);

    function recordComponentType(model, field) {
      const type = field.type;
      if (!requiredFields.get(model).has(field.key) || type.kind !== 'scalar') return field.fieldType;
      if (type.name === 'Integer') return 'int';
      if (type.name === 'Long') return 'long';
      if (type.name === 'Double') return 'double';
      if (type.name === 'Boolean') return 'boolean';
      return field.fieldType;
    }

    function javaString(value) {
      return JSON.stringify(value)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    }

    function sampleValue(value, type) {
      if (value === null || value === undefined) return 'null';
      if (type.kind === 'object') {
        const fields = modelFields.get(type) || [];
        const args = fields.map((field) => sampleValue(value[field.key], field.type));
        return `new ${modelNames.get(type)}(${args.join(', ')})`;
      }
      if (type.kind === 'array') {
        const items = Array.isArray(value) ? value : [];
        return items.length
          ? `List.of(${items.map((item) => sampleValue(item, type.element)).join(', ')})`
          : 'List.of()';
      }
      if (typeof value === 'string') return javaString(value);
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('A JSON number is outside the supported finite range.');
        if (type.name === 'Long') return `${String(value)}L`;
        if (type.name === 'BigDecimal') return `new BigDecimal(${javaString(String(value))})`;
        return String(value);
      }
      if (Array.isArray(value)) {
        return value.length ? `List.of(${value.map((item) => sampleValue(item, scalarType(typeof item === 'string' ? 'String' : typeof item === 'boolean' ? 'Boolean' : 'Object'))).join(', ')})` : 'List.of()';
      }
      if (typeof value === 'object') return 'null';
      return 'null';
    }

    function sampleRecord(value, model, indent) {
      const fields = modelFields.get(model) || [];
      const args = fields.map((field) => sampleValue(value[field.key], field.type));
      if (!args.length) return `new ${modelNames.get(model)}()`;
      const continuationIndent = ' '.repeat(indent + 4);
      return `new ${modelNames.get(model)}(\n${args.map((argument) => `${continuationIndent}${argument}`).join(',\n')}\n${' '.repeat(indent)})`;
    }

    const declarations = [...modelQueue].reverse().map((model) => {
      const name = modelNames.get(model);
      const fields = modelFields.get(model) || [];
      const components = fields.map((field) => `${field.annotation}${recordComponentType(model, field)} ${field.fieldName}`);
      return `record ${name}(${components.join(', ')}) {}`;
    });
    const imports = [];
    if (hasList) imports.push('import java.util.List;');
    if (hasBigDecimal) imports.push('import java.math.BigDecimal;');
    if (jacksonCheckbox.checked && [...modelFields.values()].some((fields) => fields.some((field) => field.annotation))) {
      imports.push('import com.fasterxml.jackson.annotation.JsonProperty;');
    }

    if (includeSampleCheckbox.checked) {
      const sampleClassName = allocateRecordName(`${rootName}Example`);
      let sampleDeclaration;
      if (isRecordArray) {
        hasList = true;
        if (!imports.includes('import java.util.List;')) imports.push('import java.util.List;');
        const variableName = rootName.toLowerCase() === 'person' ? 'people' : `${rootName.charAt(0).toLowerCase()}${rootName.slice(1)}List`;
        const values = data.map((item) => sampleRecord(item, rootFields, 8));
        const sampleRows = values.map((value) => `        ${value}`).join(',\n');
        sampleDeclaration = `    static List<${rootName}> ${variableName} = List.of(\n${sampleRows}\n    );`;
      } else {
        const variableName = rootName.charAt(0).toLowerCase() + rootName.slice(1);
        const sample = rootModel.kind === 'object'
          ? sampleValue(data, rootFields)
          : `new ${rootName}(${sampleValue(data, rootModel)})`;
        sampleDeclaration = `    static ${rootName} ${variableName} = ${sample};`;
      }
      declarations.push(`class ${sampleClassName} {\n${sampleDeclaration}\n}`);
    }

    const parts = [];
    if (packageName) parts.push(`package ${packageName};`);
    if (imports.length) parts.push(imports.join('\n'));
    parts.push(declarations.join('\n\n'));
    return { code: parts.join('\n\n'), classCount: modelQueue.length, typeLabel: 'record' };
  }

  function buildJava(data, rootName, packageName) {
    return javaStyleSelect.value === 'record'
      ? buildRecordJava(data, rootName, packageName)
      : buildClassJava(data, rootName, packageName);
  }

  function resetOutput() {
    generatedText = '';
    output.textContent = 'Generated Java classes appear here.';
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
    let packageName;
    try {
      rootName = validClassName(classNameInput.value.trim(), 'Root class name');
      packageName = validatePackage(packageNameInput.value);
    } catch (error) {
      resetOutput();
      setStatus(error.message, 'error');
      return;
    }

    try {
      const result = buildJava(data, rootName, packageName);
      generatedText = result.code;
      output.innerHTML = colorizeJava(generatedText);
      copyButton.disabled = false;
      downloadButton.disabled = false;
      document.querySelector('#rootClassStat').textContent = rootName;
      document.querySelector('#classCount').textContent = result.classCount.toLocaleString();
      document.querySelector('#outputSize').textContent = `${new TextEncoder().encode(generatedText).length.toLocaleString()} bytes`;
      stats.hidden = false;
      setStatus(`Generated ${result.classCount} Java ${result.typeLabel}${result.classCount === 1 ? '' : 's'} for ${rootName}.`, 'success');
    } catch (error) {
      resetOutput();
      setStatus(error.message, 'error');
    }
  }

  async function copyJava() {
    if (!generatedText) return;
    try {
      await navigator.clipboard.writeText(generatedText);
      setStatus('Java code copied to clipboard.', 'success');
    } catch (error) {
      setStatus('Clipboard access failed. Select the generated code and copy it manually.', 'error');
    }
  }

  function downloadJava() {
    if (!generatedText) return;
    const blob = new Blob([generatedText], { type: 'text/x-java-source;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${classNameInput.value.trim() || 'Root'}.java`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus('Java source file downloaded.', 'success');
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
    const pasted = window.prompt('Paste JSON to generate Java classes:', input.value || '');
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
  copyButton.addEventListener('click', copyJava);
  downloadButton.addEventListener('click', downloadJava);

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
