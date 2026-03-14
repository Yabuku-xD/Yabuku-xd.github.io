// Navbar active state management
(function() {
  const navLinks = document.querySelectorAll('.nav a');
  const sections = document.querySelectorAll('section[id]');
  let scrollOverride = false;
  let scrollTimeout;
  
  // Update active state on click
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // Disable scroll observer temporarily
      scrollOverride = true;
      clearTimeout(scrollTimeout);
      
      // Remove active from all and add to clicked
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      
      // Re-enable scroll observer after scroll animation completes
      scrollTimeout = setTimeout(() => {
        scrollOverride = false;
      }, 800);
    });
  });
  
  // Update active state on scroll
  const observerOptions = {
    root: null,
    rootMargin: '-35% 0px -35% 0px',
    threshold: 0
  };
  
  const observer = new IntersectionObserver((entries) => {
    if (scrollOverride) return; // Skip if click just happened
    
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = entry.target.id;
        navLinks.forEach(link => {
          link.classList.remove('active');
          // Contact link becomes active for both Writing and Contact sections
          if (sectionId === 'writing' || sectionId === 'contact') {
            if (link.getAttribute('href') === '#contact') {
              link.classList.add('active');
            }
          } else if (link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);
  
  sections.forEach(section => observer.observe(section));
  
  // Set initial active state
  const setInitialActive = () => {
    const hash = window.location.hash;
    navLinks.forEach(link => link.classList.remove('active'));
    
    if (hash) {
      const activeLink = document.querySelector(`.nav a[href="${hash}"]`);
      if (activeLink) activeLink.classList.add('active');
    } else {
      const aboutLink = document.querySelector('.nav a[href="#about"]');
      if (aboutLink) aboutLink.classList.add('active');
    }
  };
  
  setInitialActive();
  window.addEventListener('hashchange', setInitialActive);
})();

// === MINI TERMINAL ===
const miniTerminalInput = document.getElementById('miniTerminalInput');
const miniTerminalOutput = document.getElementById('miniTerminalOutput');

const miniCommands = {
  help: 'Commands: about, skills, contact, hire, joke',
  about: 'Shyamalan Kannan - Software Engineer\nSeattle University M.S. CS \'26',
  skills: 'Python, Django, React, SQL, Docker',
  contact: 'shyamalankannan@gmail.com',
  hire: 'Open to Junior SWE/SDE-1 roles!',
  joke: () => ['Why do programmers prefer dark mode? Light attracts bugs!', 'I would tell you a UDP joke but you might not get it.'][Math.floor(Math.random() * 2)]
};

miniTerminalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = miniTerminalInput.value.trim().toLowerCase();
    miniTerminalInput.value = '';
    
    if (miniCommands[cmd]) {
      const result = typeof miniCommands[cmd] === 'function' ? miniCommands[cmd]() : miniCommands[cmd];
      miniTerminalOutput.innerHTML += `<br><span style="color:oklch(55% 0.22 25)">$ ${cmd}</span><br>${result}`;
    } else if (cmd) {
      miniTerminalOutput.innerHTML += `<br><span style="color:oklch(55% 0.22 25)">$ ${cmd}</span><br>Command not found`;
    }
    
    miniTerminalOutput.scrollTop = miniTerminalOutput.scrollHeight;
  }
});

// === MINI MEMORY GAME ===
const emojis = ['⚛️', '🐍', '🐳', '☁️', '🔴', '🟢', '🔵', '🟡'];
let miniCards = [];
let miniFlipped = [];
let miniMatched = 0;
let miniMoves = 0;
let miniLocked = false;

const miniGameGrid = document.getElementById('miniGameGrid');
const miniMovesEl = document.getElementById('miniMoves');
const miniMatchesEl = document.getElementById('miniMatches');
const resetMiniGame = document.getElementById('resetMiniGame');

function initMiniGame() {
  miniCards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  miniGameGrid.innerHTML = '';
  miniFlipped = [];
  miniMatched = 0;
  miniMoves = 0;
  miniLocked = false;
  miniMovesEl.textContent = '0';
  miniMatchesEl.textContent = '0';
  
  miniCards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'mini-card';
    card.dataset.index = i;
    card.dataset.emoji = emoji;
    card.innerHTML = '<span style="opacity:0">' + emoji + '</span>';
    card.addEventListener('click', () => flipMiniCard(card));
    miniGameGrid.appendChild(card);
  });
}

function flipMiniCard(card) {
  if (miniLocked || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  
  card.classList.add('flipped');
  card.innerHTML = card.dataset.emoji;
  miniFlipped.push(card);
  
  if (miniFlipped.length === 2) {
    miniMoves++;
    miniMovesEl.textContent = miniMoves;
    miniLocked = true;
    
    if (miniFlipped[0].dataset.emoji === miniFlipped[1].dataset.emoji) {
      miniFlipped.forEach(c => {
        c.classList.add('matched');
        c.classList.remove('flipped');
      });
      miniMatched++;
      miniMatchesEl.textContent = miniMatched;
      miniFlipped = [];
      miniLocked = false;
    } else {
      setTimeout(() => {
        miniFlipped.forEach(c => {
          c.classList.remove('flipped');
          c.innerHTML = '<span style="opacity:0">' + c.dataset.emoji + '</span>';
        });
        miniFlipped = [];
        miniLocked = false;
      }, 800);
    }
  }
}

resetMiniGame.addEventListener('click', initMiniGame);
initMiniGame();

// === SCROLL-TRIGGERED ANIMATIONS ===
(function() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  let ticking = false;
  
  const animationObserver = new IntersectionObserver((entries) => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
        ticking = false;
      });
      ticking = true;
    }
  }, {
    root: null,
    rootMargin: '50px 0px 50px 0px',
    threshold: 0.05
  });
  
  animatedElements.forEach(el => animationObserver.observe(el));
  
  // Hero is visible immediately on load
  const hero = document.querySelector('.hero');
  if (hero) hero.classList.add('is-visible');
})();

// === EXPERIENCE TIMELINE ANIMATION ===
(function() {
  const experienceSection = document.querySelector('#experience');
  const timeline = document.querySelector('.experience__timeline');
  const expItems = document.querySelectorAll('.exp-item');
  
  if (!experienceSection || !timeline || expItems.length === 0) return;
  
  function updateTimeline() {
    const sectionRect = experienceSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Compress the reveal window so the section completes earlier
    const sectionTop = sectionRect.top;
    const sectionHeight = sectionRect.height;
    
    // Start just before the section fully enters the viewport and
    // finish around the time the middle/lower portion is in view.
    const startOffset = windowHeight * 0.92;
    const scrollRange = Math.max(sectionHeight * 0.65, windowHeight * 0.4);
    const currentScroll = startOffset - sectionTop;
    
    const progress = Math.max(0, Math.min(1, currentScroll / scrollRange));
    
    // Update timeline height
    timeline.style.height = (progress * 100) + '%';
    
    // Reveal items based on progress (only add, never remove)
    expItems.forEach((item, index) => {
      const itemThreshold = expItems.length === 1
        ? 0.15
        : 0.15 + (index / (expItems.length - 1)) * 0.55;

      if (progress >= itemThreshold) {
        item.classList.add('is-visible');
      }
    });
  }
  
  // Use IntersectionObserver for performance
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', updateTimeline, { passive: true });
        updateTimeline();
      } else {
        window.removeEventListener('scroll', updateTimeline);
      }
    });
  }, { threshold: 0, rootMargin: '0px' });
  
  observer.observe(experienceSection);
})();
