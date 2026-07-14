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
const CENTER_RADIUS = 70; // half of centerCore (140px)

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
const MIN_CENTER_DIST = 120; // centerCore(70) + skillNode(43) + margin

function enableSkillDragging() {
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
   MUTE / UNMUTE TOGGLE
   --------------------------------------------------------- */
function initMuteToggle() {
  const btn = document.getElementById("muteToggle");
  if (!btn) return;

  let muted = localStorage.getItem("muted") === "true";
  if (muted) btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';

  btn.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem("muted", muted);
    btn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>';
  });
}

/* ---------------------------------------------------------
   INSPIRATIONS MODAL (draggable)
   --------------------------------------------------------- */
function initInspoModal() {
  const modal = document.getElementById("inspoModal");
  const openBtn = document.getElementById("inspoBtn");
  const closeBtn = document.getElementById("inspoClose");
  const handle = document.getElementById("inspoHandle");
  if (!modal || !openBtn) return;

  // Open
  openBtn.addEventListener("click", () => {
    modal.classList.add("open");
    // Let the browser paint, then capture centered position as pixels
    requestAnimationFrame(() => {
      const rect = modal.getBoundingClientRect();
      modal.style.left = rect.left + "px";
      modal.style.top = rect.top + "px";
      modal.style.transform = "none";
    });
  });

  // Close
  if (closeBtn) {
    closeBtn.addEventListener("click", () => modal.classList.remove("open"));
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
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });
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

  // Inspirations modal
  initInspoModal();

  // Project search
  initProjectSearch();

  // Re-layout on resize
  window.addEventListener("resize", () => {
    layoutSkillCircle();
    drawSkillLines();
  });

  // Minigames
  initMinigame();
  initSkillQuiz();
  initCodeCracker();
});