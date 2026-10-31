document.documentElement.classList.add('js');

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-navigation');

if (menuToggle && navigation) {
  const closeMenu = () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
  };
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    navigation.classList.toggle('is-open', !isOpen);
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuToggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
}

const workflowTabs = [...document.querySelectorAll('[data-workflow-tab]')];
function selectWorkflow(tab) {
  workflowTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(item.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  });
}
workflowTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectWorkflow(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % workflowTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + workflowTabs.length) % workflowTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = workflowTabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectWorkflow(workflowTabs[nextIndex]);
    workflowTabs[nextIndex].focus();
  });
});

const filters = [...document.querySelectorAll('[data-product-filter]')];
filters.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.productFilter;
    filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    document.querySelectorAll('[data-product-category]').forEach((card) => {
      const visible = filter === 'all' || card.dataset.productCategory === filter;
      card.hidden = !visible;
      if (visible) count += 1;
    });
    const counter = document.querySelector('[data-filter-count]');
    if (counter) counter.textContent = `${count} ${count === 1 ? 'initiative' : 'initiatives'}`;
    const pair = document.querySelector('.product-pair');
    if (pair) pair.hidden = [...pair.children].every((card) => card.hidden);
  });
});

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
