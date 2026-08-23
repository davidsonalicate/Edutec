document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Menu mobile ---------- */
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Link ativo ao rolar a página ---------- */
  const sections = ['topo', 'praticas', 'carreiras', 'jogo']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const navLinks = document.querySelectorAll('.nav-link');

  if (sections.length && navLinks.length) {
    const setActive = (id) => {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === id);
      });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    sections.forEach(section => observer.observe(section));
  }

  /* ---------- Animação de entrada (cards e checklist) ---------- */
  const revealTargets = document.querySelectorAll('.practice-card, .check-item');

  if (revealTargets.length) {
    revealTargets.forEach(target => target.classList.add('pre-reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('in-view'), index * 60);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    revealTargets.forEach(target => revealObserver.observe(target));
  }

  /* ---------- Formulário de newsletter ---------- */
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterMsg = document.getElementById('newsletterMsg');

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const email = emailInput.value.trim();

      if (!email) return;

      newsletterMsg.textContent = `Inscrição confirmada para ${email}.`;
      newsletterForm.reset();

      setTimeout(() => { newsletterMsg.textContent = ''; }, 5000);
    });
  }

  /* ---------- Ano dinâmico no rodapé ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

});
