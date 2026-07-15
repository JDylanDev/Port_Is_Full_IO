/* =========================================================
   JDylanDev — script.js
   Handles tab groups, circular skill layout with lines,
   draggable skill nodes with center collision avoidance,
   smart repositioning of description bubbles, turtle drift,
   and an Easter-egg wiring minigame.
   ========================================================= */

/* ---------------------------------------------------------
   TAB GROUP SYSTEM (home.html, skills.html)
   --------------------------------------------------------- */
function initTabGroup(root) {
  const buttons = root.querySelectorAll("[data-tab]");
  const panels = root.querySelectorAll("[data-panel]");
  const loadingScreen = root.querySelector(".loadingScreen");

  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      const key = root.dataset.tabgroup || "tabs";

      // Persist choice — only save, no recursive .click()
      localStorage.setItem(key, target);

      // Swap active class on buttons
      buttons.forEach((b) => b.classList.toggle("active", b === btn));

      // Swap active panel
      panels.forEach((p) =>
        p.classList.toggle("active", p.dataset.panel === target)
      );

      // Re-layout after DOM paints the new panel
      requestAnimationFrame(() => {
        layoutSkillCircle();
        drawSkillLines();
      });

      if (loadingScreen) loadingScreen.classList.add("hidden");
    });
  });
}

/** Restore the last-active tab from localStorage on page load */
function restoreTabs() {
  document.querySelectorAll("[data-tabgroup]").forEach((root) => {
    const key = root.dataset.tabgroup || "tabs";
    const saved = localStorage.getItem(key);
    if (saved) {
      const btn = root.querySelector(`[data-tab="${saved}"]`);
      if (btn) btn.click();
    }
  });
}

/* ---------------------------------------------------------
   CIRCULAR SKILL LAYOUT  (skills.html)
   Distributes .skillNode elements on a circle around the
   center of each .skillMap.  Stores home positions on each
   node so drag / drift can reference them.
   --------------------------------------------------------- */
function layoutSkillCircle() {
  document.querySelectorAll(".skillMap").forEach((panel) => {
    const nodes = panel.querySelectorAll(".skillNode");
    const total = nodes.length;
    if (!total) return;

    const w = panel.clientWidth;
    const h = panel.clientHeight;
    const radius = Math.min(w, h) / 2 - 70;
    const centerX = w / 2;
    const centerY = h / 2;

    // Store on the DOM element so other functions can read them
    panel._centerX = centerX;
    panel._centerY = centerY;

    nodes.forEach((node, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      node.style.left = `${x}px`;
      node.style.top = `${y}px`;

      // Remember home so drift can oscillate around it
      node._homeX = x;
      node._homeY = y;
    });
  });
}

/* ---------------------------------------------------------
   SVG CONNECTION LINES
   Draws dashed lines from the EDGE of the center circle
   (not the center point) to each .skillNode.
   --------------------------------------------------------- */
const CENTER_RADIUS = 63; // half of centerCore (126px)

function drawSkillLines() {
  document.querySelectorAll(".skillMap").forEach((panel) => {
    const active = panel.classList.contains("active");
    const nodes = panel.querySelectorAll(".skillNode");
    if (!nodes.length) return;

    let svg = panel.querySelector(".skillLines");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "skillLines");
      panel.insertBefore(svg, panel.firstChild);
    }

    svg.innerHTML = "";

    const cx = panel._centerX || panel.clientWidth / 2;
    const cy = panel._centerY || panel.clientHeight / 2;
    const opacity = active ? "0.4" : "0";

    nodes.forEach((node) => {
      const nx = parseFloat(node.style.left) || 0;
      const ny = parseFloat(node.style.top) || 0;

      // Calculate intersection point on the center circle edge
      const dx = nx - cx;
      const dy = ny - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;

      const edgeX = cx + (dx / dist) * CENTER_RADIUS;
      const edgeY = cy + (dy / dist) * CENTER_RADIUS;

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", edgeX);
      line.setAttribute("y1", edgeY);
      line.setAttribute("x2", nx);
      line.setAttribute("y2", ny);
      line.style.stroke = "var(--primary-color)";
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-opacity", opacity);
      line.setAttribute("stroke-dasharray", "5,4");
      svg.appendChild(line);
    });
  });
}

/* ---------------------------------------------------------
   DRAGGING  (skills.html — pointer events)
   Lets the user grab and reposition skill nodes.  Enforces:
     • Bounded within the .skillMap
     • Cannot overlap the central core (radius ~70 px)
   --------------------------------------------------------- */
const MIN_CENTER_DIST = 108; // centerCore(63) + skillNode(39) + margin

function enableSkillDragging() {
  const NODE_DIAMETER = 78; // width/height of .skillNode

  document.querySelectorAll(".skillNode").forEach((node) => {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    node.addEventListener("pointerdown", (e) => {
      dragging = true;
      node.classList.add("dragging");
      node.setPointerCapture(e.pointerId);

      const rect = node.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    node.addEventListener("pointermove", (e) => {
      if (!dragging) return;

      const parent = node.parentElement;
      const parentRect = parent.getBoundingClientRect();

      let x =
        e.clientX - parentRect.left - offsetX + node.offsetWidth / 2;
      let y =
        e.clientY - parentRect.top - offsetY + node.offsetHeight / 2;

      const half = 45;
      x = Math.max(half, Math.min(parent.clientWidth - half, x));
      y = Math.max(half, Math.min(parent.clientHeight - half, y));

      const cx = parent._centerX || parent.clientWidth / 2;
      const cy = parent._centerY || parent.clientHeight / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MIN_CENTER_DIST) {
        const angle = Math.atan2(dy, dx);
        x = cx + MIN_CENTER_DIST * Math.cos(angle);
        y = cy + MIN_CENTER_DIST * Math.sin(angle);
      }

      // === SKILL NODE COLLISION: iterative push-apart resolution ===
      const otherNodes = parent.querySelectorAll(".skillNode:not(.dragging)");
      let collided = true;
      let iterations = 0;
      const MAX_ITERATIONS = 10;

      while (collided && iterations < MAX_ITERATIONS) {
        collided = false;
        iterations++;

        for (const other of otherNodes) {
          const ox = parseFloat(other.style.left) || 0;
          const oy = parseFloat(other.style.top) || 0;

          const dx2 = x - ox;
          const dy2 = y - oy;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < NODE_DIAMETER && dist2 > 0.001) {
            // Push the dragged node away along the collision normal
            const overlap = NODE_DIAMETER - dist2;
            const nx = dx2 / dist2;
            const ny = dy2 / dist2;

            x += nx * overlap * 1.01; // tiny extra push to avoid sticking
            y += ny * overlap * 1.01;
            collided = true;
          }
        }

        // Re-clamp within bounds after pushing
        x = Math.max(half, Math.min(parent.clientWidth - half, x));
        y = Math.max(half, Math.min(parent.clientHeight - half, y));
      }

      node.style.left = `${x}px`;
      node.style.top = `${y}px`;

      drawSkillLines();
    });

    node.addEventListener("pointerup", () => {
      dragging = false;
      node.classList.remove("dragging");
    });
  });
}

/* ---------------------------------------------------------
   CLICK-TO-INFO PANEL (replaces hover bubbles)
   When a skill node is clicked, show its info in the
   panel beside the skill map.
   --------------------------------------------------------- */
const SKILL_DATA = {
  godot: { name: "Godot Engine", desc: "Experienced with Godot's scene system, signals, and custom node development. Built 2D platformers and interactive tools using its flexible node-based architecture.", level: 80 },
  gdscript: { name: "GDScript", desc: "Proficient in GDScript — Godot's Python-like scripting language. Comfortable with signals, coroutines, and the built-in editor integration.", level: 85 },
  gamedesign: { name: "Game Design", desc: "Strong understanding of game mechanics, player progression, level design principles, and balancing. Prototype and iterate quickly.", level: 75 },
  animation: { name: "2D Animation", desc: "Created sprite animations, tilemaps, and particle effects. Experienced with Aseprite and Godot's AnimationPlayer for smooth 2D motion.", level: 70 },
  html: { name: "HTML", desc: "Semantic HTML5 with accessibility best practices. Comfortable with forms, multimedia, canvas, and modern structural elements.", level: 90 },
  css: { name: "CSS", desc: "CSS3 expert: flexbox, grid, custom properties, animations, responsive design with clamp/min/max, and cross-browser compatibility.", level: 88 },
  javascript: { name: "JavaScript", desc: "Vanilla JS including ES6+, DOM manipulation, event handling, async/await, and browser APIs. Comfortable with modern patterns.", level: 85 },
  responsive: { name: "Responsive Design", desc: "Mobile-first approach using media queries, fluid typography, flexible grids, and touch-friendly interactions. Tested across viewports.", level: 82 }
};

function initSkillClick() {
  const panelBody = document.getElementById("skillInfoBody");
  if (!panelBody) return;

  document.querySelectorAll(".skillNode").forEach((node) => {
    node.addEventListener("click", () => {
      // Visual feedback: highlight selected node
      document.querySelectorAll(".skillNode.active-skill").forEach((n) => n.classList.remove("active-skill"));
      node.classList.add("active-skill");

      const key = node.dataset.skill;
      const data = SKILL_DATA[key];
      if (!data) return;

      panelBody.innerHTML = `
        <div class="skillInfoName">${data.name}</div>
        <div class="skillInfoDesc">${data.desc}</div>
        <div class="skillInfoLevel">
          <div class="skillInfoLevelLabel">Proficiency</div>
          <div class="skillInfoBar"><div class="skillInfoBarFill" style="width: ${data.level}%"></div></div>
        </div>
      `;
    });
  });
}

/* ---------------------------------------------------------
   TURTLE DRIFT
   Adds a slow, gentle floating animation to every skill
   node after they've been placed on the circle.
   --------------------------------------------------------- */
function initDrift() {
  document.querySelectorAll(".skillNode").forEach((node, i) => {
    node.classList.add("drifting");
    const durations = [14, 11, 16, 13, 15, 12, 10, 17, 9];
    const offsets = [6, -5, 4, -7, 3, 5, -4, -3, 7];
    const idx = i % Math.min(durations.length, offsets.length);
    node.style.setProperty("--drift-duration", `${durations[idx]}s`);
    node.style.setProperty("--drift-offset", `${offsets[idx]}px`);
  });
}

/* ---------------------------------------------------------
   DARK / LIGHT MODE TOGGLE
   --------------------------------------------------------- */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  // Restore saved preference
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    document.body.classList.add("light-mode");
    btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    btn.innerHTML = isLight
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  });
}

/* ---------------------------------------------------------
   MUTE / UNMUTE TOGGLE (with persistent audio playback)
   --------------------------------------------------------- */
function initMuteToggle() {
  const btn = document.getElementById("muteToggle");
  if (!btn) return;

  const audio = document.getElementById("bgMusic");
  let muted = localStorage.getItem("muted") === "true";
  let started = false;

  // Restore saved mute state
  if (muted) {
    btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  }

  function restoreAudioTime() {
    if (!audio) return;
    const savedTime = parseFloat(localStorage.getItem("musicTime"));
    if (savedTime && !isNaN(savedTime) && savedTime < audio.duration) {
      audio.currentTime = savedTime;
    }
  }

  function applyMute() {
    if (!audio) return;
    audio.muted = muted;
    btn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>';
    localStorage.setItem("muted", muted);
    localStorage.setItem("musicPlaying", muted ? "false" : "true");
  }

  function startAudio() {
    if (started || !audio) return;
    started = true;
    audio.volume = 0.3;
    audio.muted = muted;
    restoreAudioTime();
    audio.play().then(() => {
      localStorage.setItem("musicPlaying", "true");
    }).catch(() => {
      // Browser may block autoplay — retry on next interaction
      started = false;
    });
  }

  btn.addEventListener("click", () => {
    muted = !muted;
    applyMute();
    startAudio();
  });

  // Save audio time & status on page unload (navigating to another page)
  window.addEventListener("beforeunload", () => {
    if (audio) {
      localStorage.setItem("musicTime", audio.currentTime);
      if (started) {
        localStorage.setItem("musicPlaying", muted ? "false" : "true");
      }
    }
  });

  // Try to start audio on first user interaction anywhere
  const tryStart = () => {
    startAudio();
  };
  document.addEventListener("click", tryStart, { once: true });
  document.addEventListener("keydown", tryStart, { once: true });
  document.addEventListener("touchstart", tryStart, { once: true });

  // Apply initial mute state
  if (muted && audio) {
    audio.muted = true;
  }

  // If music was playing before, immediately try to resume
  const wasPlaying = localStorage.getItem("musicPlaying") === "true";
  if (wasPlaying) {
    // Short delay to let audio element be ready
    setTimeout(startAudio, 400);
  }
}

/* ---------------------------------------------------------
   STAR VISIBILITY TOGGLE
   Shows/hides the falling stars layer, persists via localStorage.
   --------------------------------------------------------- */
function initStarToggle() {
  const btn = document.getElementById("starToggle");
  if (!btn) return;

  // Restore saved preference (default: visible)
  const hidden = localStorage.getItem("starsHidden") === "true";
  if (hidden) {
    document.querySelectorAll(".cometLayer").forEach((layer) => {
      layer.classList.add("stars-hidden");
    });
    btn.innerHTML = '<i class="fa-solid fa-star" style="opacity:0.35"></i>';
  }

  btn.addEventListener("click", () => {
    const layers = document.querySelectorAll(".cometLayer");
    const isHidden = layers[0]?.classList.contains("stars-hidden");

    layers.forEach((layer) => {
      layer.classList.toggle("stars-hidden");
    });

    const nowHidden = !isHidden;
    localStorage.setItem("starsHidden", nowHidden ? "true" : "false");
    btn.innerHTML = nowHidden
      ? '<i class="fa-solid fa-star" style="opacity:0.35"></i>'
      : '<i class="fa-solid fa-star"></i>';
  });
}

/* ---------------------------------------------------------
   INSPIRATIONS MODAL (draggable, with backdrop overlay)
   --------------------------------------------------------- */
function initInspoModal() {
  const modal = document.getElementById("inspoModal");
  const openBtn = document.getElementById("inspoBtn");
  const closeBtn = document.getElementById("inspoClose");
  const handle = document.getElementById("inspoHandle");
  if (!modal || !openBtn) return;

  // Create backdrop overlay
  let backdrop = document.getElementById("inspoBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "inspoBackdrop";
    backdrop.className = "inspoBackdrop";
    document.body.appendChild(backdrop);
  }

  function openModal() {
    backdrop.classList.add("open");
    modal.classList.add("open");
    // Let the browser paint, then capture centered position as pixels
    requestAnimationFrame(() => {
      const rect = modal.getBoundingClientRect();
      modal.style.left = rect.left + "px";
      modal.style.top = rect.top + "px";
      modal.style.transform = "none";
    });
  }

  function closeModal() {
    backdrop.classList.remove("open");
    modal.classList.remove("open");
  }

  // Open
  openBtn.addEventListener("click", openModal);

  // Close
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  // Drag
  let dragging = false, startX, startY, origX, origY;

  function onStart(e) {
    if (!handle) return;
    if (e.target.closest(".inspoClose")) return;
    dragging = true;
    const rect = modal.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    startX = clientX;
    startY = clientY;
    origX = rect.left;
    origY = rect.top;
    modal.style.transform = "none";
    modal.style.left = origX + "px";
    modal.style.top = origY + "px";
  }

  function onMove(e) {
    if (!dragging) return;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    modal.style.left = origX + (clientX - startX) + "px";
    modal.style.top = origY + (clientY - startY) + "px";
  }

  function onEnd() { dragging = false; }

  if (handle) {
    handle.addEventListener("mousedown", onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    handle.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  }

  // Close on backdrop click
  backdrop.addEventListener("click", closeModal);
}

/* ---------------------------------------------------------
   PROJECT SEARCH / FILTER
   Searches by title first, then description & tags.
   Shows per-section empty states for solo & team.
   --------------------------------------------------------- */
function initProjectSearch() {
  const input = document.getElementById("projectSearch");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const shelves = document.querySelectorAll(".libShelf");
    let totalVisible = 0;

    shelves.forEach((shelf) => {
      const cards = shelf.querySelectorAll(".projectCard");
      const section = shelf.dataset.section;
      let visible = 0;

      cards.forEach((card) => {
        const title = card.querySelector("h4")?.textContent?.toLowerCase() || "";
        const desc = card.querySelector("p")?.textContent?.toLowerCase() || "";
        const tags = Array.from(card.querySelectorAll(".techStack span"))
          .map((s) => s.textContent.toLowerCase())
          .join(" ");

        // Match: title gets priority (weighted match), then desc/tags
        const titleMatch = q && title.includes(q);
        const otherMatch = q && (desc.includes(q) || tags.includes(q));
        const match = !q || titleMatch || otherMatch;

        card.style.display = match ? "" : "none";
        if (match) visible++;
      });

      totalVisible += visible;

      // Per-section empty state
      const sectionEmpty = document.getElementById(`libEmpty${section.charAt(0).toUpperCase() + section.slice(1)}`);
      if (sectionEmpty) {
        sectionEmpty.classList.toggle("hidden", visible > 0 || !q);
      }
    });

    // Global empty state (fallback)
    const globalEmpty = document.getElementById("libEmpty");
    if (globalEmpty) {
      globalEmpty.classList.toggle("hidden", totalVisible > 0);
    }
  });
}

/* ---------------------------------------------------------
   EASTER EGG: IMPROVED "FIX WIRING" MINIGAME
   --------------------------------------------------------- */
function initMinigame() {
  const WIRE_COLORS = ["#c51111", "#132ed1", "#f5f557", "#117f2d"];
  let moveCount = 0;

  const overlay = document.createElement("div");
  overlay.className = "minigameOverlay";
  overlay.innerHTML = `
    <div class="minigameBox" role="dialog" aria-label="Fix Wiring minigame">
      <button type="button" class="minigameClose" aria-label="Close">&times;</button>
      <h3><i class="fa-solid fa-triangle-exclamation"></i> FIX WIRING</h3>
      <p class="minigameHint">Match each wire on the left to its twin on the right.</p>
      <div class="wireRow">
        <div class="wireColumn" data-side="left"></div>
        <div class="wireColumn" data-side="right"></div>
      </div>
      <div class="minigameScore">
        <span>Moves: <strong id="moveCount">0</strong></span>
      </div>
      <p class="minigameSuccess">All connected! System restored! 🚀</p>
      <button type="button" class="minigameNewGame" style="display:none">Play Again</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const leftCol = overlay.querySelector('[data-side="left"]');
  const rightCol = overlay.querySelector('[data-side="right"]');
  const successMsg = overlay.querySelector(".minigameSuccess");
  const closeBtn = overlay.querySelector(".minigameClose");
  const moveDisplay = document.getElementById("moveCount");
  const newGameBtn = overlay.querySelector(".minigameNewGame");

  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildWires() {
    leftCol.innerHTML = "";
    rightCol.innerHTML = "";
    successMsg.classList.remove("show");
    newGameBtn.style.display = "none";
    moveCount = 0;
    if (moveDisplay) moveDisplay.textContent = "0";

    WIRE_COLORS.forEach((color) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "wireDot";
      dot.style.background = color;
      dot.dataset.color = color;
      leftCol.appendChild(dot);
    });

    shuffled(WIRE_COLORS).forEach((color) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "wireDot";
      dot.style.background = color;
      dot.dataset.color = color;
      rightCol.appendChild(dot);
    });

    let selected = null;

    overlay.querySelectorAll(".wireDot").forEach((dot) => {
      dot.addEventListener("click", () => {
        if (dot.classList.contains("connected")) return;

        if (!selected) {
          selected = dot;
          dot.classList.add("selected");
          return;
        }

        if (selected === dot) {
          selected.classList.remove("selected");
          selected = null;
          return;
        }

        const sameSide = selected.parentElement === dot.parentElement;
        if (sameSide) {
          selected.classList.remove("selected");
          selected = dot;
          dot.classList.add("selected");
          return;
        }

        moveCount++;
        if (moveDisplay) moveDisplay.textContent = moveCount;

        if (selected.dataset.color === dot.dataset.color) {
          selected.classList.remove("selected");
          selected.classList.add("connected");
          dot.classList.add("connected");
          selected = null;

          const allConnected = overlay.querySelectorAll(
            ".wireDot.connected"
          ).length;
          if (allConnected === WIRE_COLORS.length * 2) {
            successMsg.classList.add("show");
            newGameBtn.style.display = "inline-block";
          }
        } else {
          dot.classList.add("wrong");
          selected.classList.add("wrong");
          setTimeout(() => {
            dot.classList.remove("wrong");
            selected.classList.remove("wrong", "selected");
            selected = null;
          }, 400);
        }
      });
    });
  }

  newGameBtn.addEventListener("click", buildWires);

  document.querySelectorAll(".tabletButton").forEach((btn) => {
    btn.addEventListener("click", () => {
      buildWires();
      overlay.classList.add("open");
    });
  });

  function closeModal() {
    overlay.classList.remove("open");
  }

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
}

/* ---------------------------------------------------------
   SKILL QUIZ MINIGAME (skills.html)
   Click the center core to test your skill knowledge!
   --------------------------------------------------------- */
function initSkillQuiz() {
  const centers = document.querySelectorAll(".centerCore");
  centers.forEach((core) => {
    core.style.cursor = "pointer";
    core.addEventListener("click", () => openSkillQuiz(core));
  });
}

const SKILL_QUESTIONS = [
  {
    q: "What does CSS stand for?",
    opts: ["Cascading Style Sheets", "Computer Style System", "Creative Style Sheets", "Colorful Style Syntax"],
    ans: 0
  },
  {
    q: "Which game engine uses GDScript?",
    opts: ["Unity", "Unreal Engine", "Godot", "GameMaker"],
    ans: 2
  },
  {
    q: "What does 'DOM' stand for in web development?",
    opts: ["Document Object Model", "Data Object Management", "Digital Order Module", "Document Orientation Method"],
    ans: 0
  },
  {
    q: "Which HTML tag is used for the largest heading?",
    opts: ["<heading>", "<h1>", "<head>", "<h6>"],
    ans: 1
  },
  {
    q: "What is the primary purpose of a constructor in OOP?",
    opts: ["Destroy objects", "Initialize objects", "Count objects", "Hide objects"],
    ans: 1
  }
];

function openSkillQuiz(core) {
  const overlay = document.createElement("div");
  overlay.className = "minigameOverlay open";
  overlay.innerHTML = `
    <div class="minigameBox wide" role="dialog" aria-label="Skill Quiz">
      <button type="button" class="minigameClose" id="quizClose" aria-label="Close">&times;</button>
      <h3><i class="fa-solid fa-graduation-cap"></i> SKILL QUIZ</h3>
      <p class="minigameHint">Test your knowledge! Click the correct answer.</p>
      <div class="quizQuestion" id="quizQuestion"></div>
      <div class="quizOptions" id="quizOptions"></div>
      <div class="quizScore">Score: <strong id="quizScore">0</strong> / 5</div>
      <button type="button" class="quizNext" id="quizNext">Next &rarr;</button>
      <button type="button" class="minigameNewGame" id="quizRestart" style="display:none">Play Again</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector("#quizClose");
  const qEl = overlay.querySelector("#quizQuestion");
  const optsEl = overlay.querySelector("#quizOptions");
  const scoreEl = overlay.querySelector("#quizScore");
  const nextBtn = overlay.querySelector("#quizNext");
  const restartBtn = overlay.querySelector("#quizRestart");

  let shuffled = [...SKILL_QUESTIONS].sort(() => Math.random() - 0.5);
  let current = 0;
  let score = 0;

  function showQuestion() {
    if (current >= shuffled.length) {
      qEl.textContent = `Quiz complete! Final score: ${score} / ${shuffled.length}`;
      optsEl.innerHTML = "";
      nextBtn.style.display = "none";
      restartBtn.style.display = "inline-block";
      scoreEl.textContent = `${score} / ${shuffled.length}`;
      return;
    }

    const q = shuffled[current];
    qEl.textContent = `Q${current + 1}: ${q.q}`;
    optsEl.innerHTML = "";
    nextBtn.style.display = "none";

    q.opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quizOption";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        if (optsEl.querySelector(".correct") || optsEl.querySelector(".wrong")) return;
        const correct = i === q.ans;
        btn.classList.add(correct ? "correct" : "wrong");
        if (!correct) {
          optsEl.children[q.ans].classList.add("correct");
        } else {
          score++;
          scoreEl.textContent = `${score} / ${shuffled.length}`;
        }
        nextBtn.style.display = "inline-block";
      });
      optsEl.appendChild(btn);
    });
  }

  nextBtn.addEventListener("click", () => {
    current++;
    showQuestion();
  });

  restartBtn.addEventListener("click", () => {
    shuffled = [...SKILL_QUESTIONS].sort(() => Math.random() - 0.5);
    current = 0;
    score = 0;
    restartBtn.style.display = "none";
    scoreEl.textContent = `0 / ${shuffled.length}`;
    showQuestion();
  });

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  showQuestion();
}

/* ---------------------------------------------------------
   MATRIX RAIN (applied to all pages)
   Lower opacity, adapts to dark/light mode automatically
   via CSS custom properties.
   --------------------------------------------------------- */
function initMatrixRain() {
  const canvas = document.getElementById("matrixRain");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF".split("");
  const fontSize = 11;
  let columns, drops;

  function initDrops() {
    columns = Math.floor(canvas.width / fontSize);
    drops = Array(columns).fill(1);
  }
  initDrops();

  // Re-init drops on resize so columns stay in sync
  const origResize = resizeCanvas;
  window.removeEventListener("resize", origResize);
  window.addEventListener("resize", () => {
    resizeCanvas();
    initDrops();
  });

  let lastTime = 0;
  const interval = 40;

  function isLightMode() {
    return document.body.classList.contains("light-mode");
  }

  function drawRain(timestamp) {
    if (timestamp - lastTime < interval) {
      requestAnimationFrame(drawRain);
      return;
    }
    lastTime = timestamp;

    const light = isLightMode();

    // Trail fade — slightly heavier for better visibility
    const fadeAlpha = light ? "0.06" : "0.09";
    ctx.fillStyle = light
      ? `rgba(200, 210, 224, ${fadeAlpha})`
      : `rgba(8, 10, 14, ${fadeAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + "px 'JetBrains Mono', monospace";

    // Increased base opacity for both themes
    const baseColor = light ? "14, 90, 82" : "79, 224, 203";
    const globalOpacity = light ? 0.58 : 0.52;

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      const brightness = Math.max(0, 1 - (y / canvas.height) * 0.6);
      ctx.fillStyle = `rgba(${baseColor}, ${brightness * globalOpacity})`;
      ctx.fillText(char, x, y);

      // Brighten top characters more often for that classic matrix glow
      if (Math.random() > 0.95) {
        ctx.fillStyle = `rgba(${baseColor}, ${brightness * globalOpacity * 1.8})`;
        ctx.fillText(char, x, y);
      }

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    requestAnimationFrame(drawRain);
  }

  requestAnimationFrame(drawRain);
}


/* ---------------------------------------------------------
   STAR / COMET GENERATOR
   Creates a natural-looking field of falling stars with
   varied sizes, speeds, angles, and delays.
   --------------------------------------------------------- */
function initComets() {
  const layers = document.querySelectorAll(".cometLayer");
  layers.forEach((layer) => {
    layer.innerHTML = "";

    const starCount = 28;
    const svgNS = "http://www.w3.org/2000/svg";

    // Generate random star positions with natural variation
    for (let i = 0; i < starCount; i++) {
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "comet");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("aria-hidden", "true");

      // Star shape (4-point sparkle for variety)
      const shape = Math.random() > 0.4
        ? "M50 0 C55 40 60 45 100 50 C60 55 55 60 50 100 C45 60 40 55 0 50 C40 45 45 40 50 0 Z"
        : "M50 5 L55 40 L95 50 L55 60 L50 95 L45 60 L5 50 L45 40 Z";

      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", shape);
      svg.appendChild(path);

      // Randomize position (spread across full width, varying heights above viewport)
      const left = Math.random() * 95 + "%";
      const topOffset = -Math.random() * 35 - 5; // -5% to -40%
      const top = topOffset + "%";

      // Randomize size: mix of small (14-20px), medium (22-30px), and large (32-40px)
      const sizeVariation = Math.random();
      let size;
      if (sizeVariation < 0.4) size = 14 + Math.random() * 6;      // small: 14-20
      else if (sizeVariation < 0.75) size = 22 + Math.random() * 8; // medium: 22-30
      else size = 32 + Math.random() * 8;                           // large: 32-40

      // Randomize fall duration (4-12 seconds)
      const duration = 4 + Math.random() * 8;

      // Randomize delay (0 to -10 seconds offset)
      const delay = -Math.random() * 10;

      // Random opacity (0.4-0.9)
      const opacity = 0.4 + Math.random() * 0.5;

      // Random rotation offset for natural angle variation
      const angleOffset = (Math.random() - 0.5) * 20;
      svg.style.setProperty("--star-angle", angleOffset + "deg");

      svg.style.left = left;
      svg.style.top = top;
      svg.style.width = size + "px";
      svg.style.height = size + "px";
      svg.style.opacity = opacity;
      svg.style.animationDuration = duration + "s";
      svg.style.animationDelay = delay + "s";

      layer.appendChild(svg);
    }
  });
}

/* ---------------------------------------------------------
   CODE CRACKER MINIGAME (projects.html)
   Click the "Play a Game" button in the library header.
   --------------------------------------------------------- */
function initCodeCracker() {
  const trigger = document.getElementById("codeCrackerBtn");
  if (!trigger) return;

  trigger.addEventListener("click", () => {
    openCodeCracker();
  });
}

const CRACKER_SYMBOLS = ["🔵", "🔴", "🟢", "🟡", "🟣", "🟠", "💎", "🔥"];

function openCodeCracker() {
  const overlay = document.createElement("div");
  overlay.className = "minigameOverlay open";
  overlay.innerHTML = `
    <div class="minigameBox wide" role="dialog" aria-label="Code Cracker">
      <button type="button" class="minigameClose" id="crackerClose" aria-label="Close">&times;</button>
      <h3><i class="fa-solid fa-brain"></i> CODE CRACKER</h3>
      <p class="minigameHint">Match the pairs to crack the code!</p>
      <div class="crackerGrid" id="crackerGrid"></div>
      <div class="crackerMoves">Moves: <strong id="crackerMoves">0</strong> &nbsp;|&nbsp; Pairs: <strong id="crackerPairs">0</strong> / 8</div>
      <p class="minigameSuccess" id="crackerSuccess">Code cracked! Nice work! 🎉</p>
      <button type="button" class="crackerNewGame" id="crackerNewGame">New Game</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector("#crackerGrid");
  const movesEl = overlay.querySelector("#crackerMoves");
  const pairsEl = overlay.querySelector("#crackerPairs");
  const successEl = overlay.querySelector("#crackerSuccess");
  const closeBtn = overlay.querySelector("#crackerClose");
  const newGameBtn = overlay.querySelector("#crackerNewGame");

  let moves = 0;
  let pairs = 0;
  let flipped = [];
  let locked = false;

  function buildGame() {
    grid.innerHTML = "";
    moves = 0;
    pairs = 0;
    flipped = [];
    locked = false;
    movesEl.textContent = "0";
    pairsEl.textContent = "0";
    successEl.classList.remove("show");

    const symbols = [...CRACKER_SYMBOLS, ...CRACKER_SYMBOLS];
    for (let i = symbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }

    symbols.forEach((sym, idx) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "crackerTile";
      tile.dataset.symbol = sym;
      tile.dataset.index = idx;

      tile.addEventListener("click", () => {
        if (locked || tile.classList.contains("flipped") || tile.classList.contains("matched")) return;

        tile.classList.add("flipped");
        tile.textContent = sym;
        flipped.push(tile);

        if (flipped.length === 2) {
          locked = true;
          moves++;
          movesEl.textContent = moves;

          if (flipped[0].dataset.symbol === flipped[1].dataset.symbol) {
            flipped[0].classList.add("matched");
            flipped[1].classList.add("matched");
            flipped = [];
            locked = false;
            pairs++;
            pairsEl.textContent = pairs;

            if (pairs === 8) {
              successEl.classList.add("show");
            }
          } else {
            setTimeout(() => {
              flipped[0].classList.remove("flipped");
              flipped[1].classList.remove("flipped");
              flipped[0].textContent = "";
              flipped[1].textContent = "";
              flipped = [];
              locked = false;
            }, 800);
          }
        }
      });

      grid.appendChild(tile);
    });
  }

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  newGameBtn.addEventListener("click", buildGame);

  buildGame();
}

/* ---------------------------------------------------------
   PAGE TRANSITIONS
   Intercepts nav clicks to fade out before navigating.
   Fade-in is handled by CSS animation on page load.
   --------------------------------------------------------- */
function initPageTransitions() {
  // Only on main pages (home, skills, projects), not splash
  if (document.querySelector(".splash")) return;

  const navLinks = document.querySelectorAll("nav a");
  if (!navLinks.length) return;

  let exitTimer = null;

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      // Don't intercept active page or external links
      if (link.classList.contains("activePage")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;

      e.preventDefault();

      // Fade out only the main content area — header & footer stay stable
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.classList.add("page-exiting");
      document.body.classList.add("page-exiting");

      // Clear any pending navigation from rapid clicks
      if (exitTimer) clearTimeout(exitTimer);
      exitTimer = setTimeout(() => {
        window.location.href = href;
      }, 200);
    });
  });

  // Handle browser back/forward navigation
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      // Page was restored from bfcache — re-trigger enter animation
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.classList.remove("page-exiting");
      document.body.classList.remove("page-exiting");
    }
  });
}

/* =========================================================
   BOOT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Tab groups
  document.querySelectorAll("[data-tabgroup]").forEach(initTabGroup);
  restoreTabs();

  // Skill tree layout
  layoutSkillCircle();
  drawSkillLines();
  enableSkillDragging();
  initSkillClick();
  initDrift();

  // Theme & mute toggles
  initThemeToggle();
  initMuteToggle();

  // Star visibility toggle
  initStarToggle();

  // Inspirations modal
  initInspoModal();

  // Project search
  initProjectSearch();

  // Matrix rain background (on all pages)
  initMatrixRain();

  // Mark skills page as ready (fade-in to prevent flash)
  const skillsPage = document.querySelector(".skillsPage");
  if (skillsPage) {
    // Wait for first layout + paint, then fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skillsPage.classList.add("ready");
      });
    });
  }

  // Re-layout on resize
  window.addEventListener("resize", () => {
    layoutSkillCircle();
    drawSkillLines();
  });

  // Page transitions (fade-in on load, fade-out on navigate)
  initPageTransitions();

  // Falling stars (replaces static HTML duplication)
  initComets();


  // Minigames
  initMinigame();
  initSkillQuiz();
  initCodeCracker();
});