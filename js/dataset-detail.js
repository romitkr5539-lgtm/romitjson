(() => {
  const catalog = window.romitJsonDatasets;
  const params = new URLSearchParams(window.location.search);
  const dataset = catalog.datasets.find((item) => item.slug === params.get('dataset'));
  const loading = document.getElementById('datasetLoading');
  const error = document.getElementById('datasetError');
  const content = document.getElementById('datasetContent');
  const preview = document.getElementById('datasetPreview');
  const status = document.getElementById('datasetStatus');
  const copyButton = document.getElementById('copyDataset');
  const downloadButton = document.getElementById('downloadDataset');
  const expandButton = document.getElementById('expandPreview');
  let rawJson = '';
  let prettyJson = '';
  let previewExpanded = false;

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `dataset-status${type ? ` ${type}` : ''}`;
  }

  function showError(message) {
    loading.hidden = true;
    content.hidden = true;
    error.hidden = false;
    document.getElementById('datasetErrorText').textContent = message;
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
      let className = 'json-punctuation';
      if (match[1]) className = 'json-key';
      else if (match[2]) className = 'json-string';
      else if (/^-?\d/.test(token)) className = 'json-number';
      else if (/^(true|false|null)$/.test(token)) className = 'json-boolean';
      html += `<span class="${className}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    return html + escapeHtml(json.slice(cursor));
  }

  function recordCount(value) {
    return Array.isArray(value) ? value.length : (value === null ? 0 : 1);
  }

  function setupPage(value) {
    const explanation = catalog.explanations[dataset.slug];
    prettyJson = JSON.stringify(value, null, 2);
    preview.innerHTML = highlightJson(prettyJson);
    document.title = `${dataset.name} JSON Dataset | RomitJSON`;
    const descriptionSentence = dataset.description.split('. ')[0];
    const metaDescription = descriptionSentence.length <= 155
      ? descriptionSentence
      : `${descriptionSentence.slice(0, 152).replace(/\s+\S*$/, '')}...`;
    document.querySelector('meta[name="description"]').content = metaDescription;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = metaDescription;
    document.querySelector('meta[property="og:url"]').content = `https://romitjson.com/datasets/item.html?dataset=${encodeURIComponent(dataset.slug)}`;
    document.querySelector('meta[name="twitter:title"]').content = document.title;
    document.querySelector('meta[name="twitter:description"]').content = metaDescription;
    document.querySelector('link[rel="canonical"]').href =
      `https://romitjson.com/datasets/item.html?dataset=${encodeURIComponent(dataset.slug)}`;
    document.getElementById('breadcrumbName').textContent = dataset.name;
    document.getElementById('datasetCategory').textContent = dataset.category;
    document.getElementById('datasetTitle').textContent = dataset.name;
    document.getElementById('datasetDescription').textContent = dataset.description;
    document.getElementById('datasetFile').textContent = `File: ${dataset.file}`;
    document.getElementById('datasetRecordCount').textContent = `${recordCount(value).toLocaleString()} ${recordCount(value) === 1 ? 'record' : 'records'}`;
    const contents = document.getElementById('datasetContents');
    for (const detail of explanation.contains) {
      const item = document.createElement('li');
      item.textContent = detail;
      contents.appendChild(item);
    }
    document.getElementById('datasetUseCases').textContent = explanation.useCases;

    const relatedContainer = document.getElementById('relatedDatasets');
    for (const relatedSlug of dataset.related) {
      const related = catalog.datasets.find((item) => item.slug === relatedSlug);
      if (!related) continue;
      const link = document.createElement('a');
      link.href = `item.html?dataset=${encodeURIComponent(related.slug)}`;
      link.textContent = related.name;
      relatedContainer.appendChild(link);
    }

    const formatterLink = document.getElementById('openFormatter');
    formatterLink.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        sessionStorage.setItem('romitjson:formatter-input', rawJson);
        window.location.assign(new URL('../json-formatter/', window.location.href));
      } catch {
        setStatus('Could not prepare the formatter handoff. Copy or download the JSON and open it in the formatter instead.', 'error');
      }
    });
    document.getElementById('openViewer').addEventListener('click', (event) => {
      event.preventDefault();
      try {
        sessionStorage.setItem('romitjson:formatter-input', rawJson);
        window.location.assign(new URL('../json-viewer/', window.location.href));
      } catch {
        setStatus('Could not prepare the viewer handoff. Copy or download the JSON and open it in the viewer instead.', 'error');
      }
    });

    copyButton.disabled = false;
    downloadButton.disabled = false;
    content.hidden = false;
    loading.hidden = true;
    requestAnimationFrame(() => {
      if (preview.scrollHeight > preview.clientHeight + 2) expandButton.hidden = false;
    });
  }

  copyButton.addEventListener('click', async () => {
    if (!rawJson) return;
    try {
      await navigator.clipboard.writeText(rawJson);
      setStatus('Complete dataset JSON copied to the clipboard.', 'success');
    } catch {
      setStatus('Clipboard access failed. Use Download JSON or select the preview and copy it manually.', 'error');
    }
  });

  downloadButton.addEventListener('click', () => {
    if (!rawJson || !dataset) return;
    const blob = new Blob([rawJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dataset.file;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus(`${dataset.file} downloaded.`, 'success');
  });

  expandButton.addEventListener('click', () => {
    previewExpanded = !previewExpanded;
    preview.classList.toggle('is-expanded', previewExpanded);
    expandButton.textContent = previewExpanded ? 'Collapse preview' : 'Expand preview';
    expandButton.setAttribute('aria-expanded', String(previewExpanded));
  });

  document.getElementById('menuBtn').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const isOpen = document.getElementById('mainNav').classList.toggle('open');
    button.setAttribute('aria-expanded', String(isOpen));
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
  document.getElementById('year').textContent = String(new Date().getFullYear());

  if (!dataset) {
    showError('Choose a dataset from the library to open its preview.');
    return;
  }

  fetch(`../data/datasets/${encodeURIComponent(dataset.file)}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Dataset file request failed (${response.status}).`);
      return response.text();
    })
    .then((text) => {
      rawJson = text;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error('The dataset file contains invalid JSON.');
      }
      setupPage(value);
    })
    .catch((loadError) => showError(`Could not load this dataset. ${loadError.message} Try again later or return to the library.`));
})();
