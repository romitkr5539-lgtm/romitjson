(() => {
  const searchInput = document.getElementById('datasetSearch');
  const categorySelect = document.getElementById('datasetCategory');
  const clearButton = document.getElementById('clearFilters');
  const cards = [...document.querySelectorAll('.dataset-card')];
  const emptyState = document.getElementById('datasetsEmpty');
  const resultCount = document.getElementById('datasetResults');

  function filterDatasets() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const category = categorySelect.value;
    let visible = 0;
    for (const card of cards) {
      const matchesQuery = !query || `${card.textContent} ${card.dataset.search}`.toLocaleLowerCase().includes(query);
      const matchesCategory = !category || card.dataset.category === category;
      const isVisible = matchesQuery && matchesCategory;
      card.hidden = !isVisible;
      if (isVisible) visible += 1;
    }
    emptyState.hidden = visible !== 0;
    resultCount.textContent = `Showing ${visible} of ${cards.length} datasets`;
  }

  searchInput.addEventListener('input', filterDatasets);
  categorySelect.addEventListener('change', filterDatasets);
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    categorySelect.value = '';
    filterDatasets();
    searchInput.focus();
  });

  const menuButton = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');
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
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
