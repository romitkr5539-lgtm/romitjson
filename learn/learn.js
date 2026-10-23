(() => {
  const search = document.getElementById('learnSearch');
  const category = document.getElementById('learnCategory');
  const clear = document.getElementById('learnClear');
  const cards = [...document.querySelectorAll('.learn-card')];
  const empty = document.getElementById('learnEmpty');
  const results = document.getElementById('learnResults');
  const menuButton = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');

  if (search && category && clear && empty && results) {
    function filterTutorials() {
      const query = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const card of cards) {
        const matches = (!query || `${card.textContent} ${card.dataset.search}`.toLocaleLowerCase().includes(query))
          && (!category.value || card.dataset.category === category.value);
        card.hidden = !matches;
        if (matches) visible += 1;
      }
      empty.hidden = visible !== 0;
      results.textContent = `Showing ${visible} of ${cards.length} tutorials`;
    }

    search.addEventListener('input', filterTutorials);
    category.addEventListener('change', filterTutorials);
    clear.addEventListener('click', () => {
      search.value = '';
      category.value = '';
      filterTutorials();
      search.focus();
    });
  }
  if (menuButton && mainNav) {
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
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

(() => {
  const feedback = document.getElementById('tutorialFeedback');
  let feedbackTimer;

  function showFeedback(message) {
    feedback.textContent = message;
    feedback.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedback.hidden = true;
    }, 3500);
  }

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.querySelector(button.dataset.copyTarget);
      if (!target) {
        showFeedback('Could not find the example to copy.');
        return;
      }
      try {
        await navigator.clipboard.writeText(target.innerText);
        showFeedback('Example copied to clipboard.');
      } catch (error) {
        showFeedback(`Copy failed: ${error.message}`);
      }
    });
  });

  document.querySelectorAll('[data-try-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.dataset.tryTarget);
      if (!target) {
        event.preventDefault();
        showFeedback('Could not find the example to open.');
        return;
      }
      try {
        sessionStorage.setItem('romitjson:formatter-input', target.innerText);
      } catch (error) {
        event.preventDefault();
        showFeedback(`Could not prepare the Formatter: ${error.message}`);
      }
    });
  });
})();
