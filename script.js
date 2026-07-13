/* =========================================================
   JDylanDev — script.js
   Handles every "click a tab, show a panel" interaction that
   used to be done with hidden <input type="radio"> + CSS
   sibling selectors. Works for:
     - home.html   -> .infoSection   (About/Hobbies/Education/Socials)
     - skills.html   -> .skillTreePanel (circular skill tree)
     - projects.html -> .projectThemes (Solo / Team tabs)
   ========================================================= */

function initTabGroup(root) {
  const buttons = root.querySelectorAll("[data-tab]");
  const panels = root.querySelectorAll("[data-panel]");
  const loadingScreen = root.querySelector(".loadingScreen");

  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      localStorage.setItem(root.dataset.tabgroup || "tabs", target);
      
      const saved = localStorage.getItem(root.dataset.tabgroup || "tabs");

      if (saved) {
          root.querySelector(`[data-tab="${saved}"]`)?.click();
      }

      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((p) =>
        p.classList.toggle("active", p.dataset.panel === target)
      );

      requestAnimationFrame(layoutSkillCircle);

      if (loadingScreen) loadingScreen.classList.add("hidden");
    });
  });
}

/* ---------------------------------------------------------
   Circular skill tree (skills.html)
   Positions every .skillNode on a circle around the center
   of .skillTreePanel using basic trig, so adding/removing a
   skill later just works — you don't hand-place coordinates.
   --------------------------------------------------------- */
function layoutSkillCircle() {
  const panels = document.querySelectorAll(".skillMap");

  panels.forEach(panel => {
    const nodes = panel.querySelectorAll(".skillNode");
    const total = nodes.length;
    if (!total) return;

    const radius = Math.min(panel.clientWidth, panel.clientHeight) / 2 - 70;
    const centerX = panel.clientWidth / 2;
    const centerY = panel.clientHeight / 2;

    nodes.forEach((node, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;

      node.style.left = `${
        centerX + radius * Math.cos(angle)
      }px`;

      node.style.top = `${
        centerY + radius * Math.sin(angle)
      }px`;
    });
  });
}

function enableSkillDragging(){
    document.querySelectorAll(".skillNode").forEach(node=>{
        let dragging=false;
        let offsetX=0;
        let offsetY=0;

        node.addEventListener("pointerdown",e=>{

            dragging=true;

            node.classList.add("dragging");
            node.setPointerCapture(e.pointerId);

            const rect=node.getBoundingClientRect();

            offsetX=e.clientX-rect.left;
            offsetY=e.clientY-rect.top;
        });

        node.addEventListener("pointermove",e=>{
            if(!dragging) return;

            const parent=node.parentElement;
            const parentRect=parent.getBoundingClientRect();

            let x=e.clientX-parentRect.left-offsetX+node.offsetWidth/2;
            let y=e.clientY-parentRect.top-offsetY+node.offsetHeight/2;

            x=Math.max(45,Math.min(parent.clientWidth-45,x));
            y=Math.max(45,Math.min(parent.clientHeight-45,y));

            node.style.left=x+"px";
            node.style.top=y+"px";
        });

        node.addEventListener("pointerup",()=>{
            dragging=false;
            node.classList.remove("dragging");
        });
    });
}

function smartSkillBubbles(){
    document.querySelectorAll(".skillNode").forEach(node=>{
        const bubble=node.querySelector(".skillBubble");

        if(!bubble)return;

        node.addEventListener("mouseenter",()=>{

            bubble.style.left="50%";
            bubble.style.right="";
            bubble.style.top="";
            bubble.style.bottom="115%";

            const map=node.closest(".skillMap");
            const mapRect=map.getBoundingClientRect();
            const rect=bubble.getBoundingClientRect();

            if(rect.left<mapRect.left){
                bubble.style.left="0";
                bubble.style.transform="translateX(0)";
            }

            if(rect.right>mapRect.right){
                bubble.style.left="auto";
                bubble.style.right="0";
                bubble.style.transform="translateX(0)";
            }

            if(rect.top<mapRect.top){
                bubble.style.bottom="auto";
                bubble.style.top="115%";
                bubble.querySelector("strong");
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-tabgroup]").forEach(initTabGroup);

  layoutSkillCircle();
  enableSkillDragging();
  smartSkillBubbles();
  window.addEventListener("resize", layoutSkillCircle);

  initMinigame();
});

/* ---------------------------------------------------------
   Easter egg: "Fix Wiring" minigame, opened by clicking the
   circular button on the tablet frame (.tabletButton).
   Built once in JS and reused on every page so home.html,
   skills.html and projects.html don't each need a copy of
   the markup.
   --------------------------------------------------------- */
function initMinigame() {
  const WIRE_COLORS = ["#c51111", "#132ed1", "#f5f557", "#117f2d"];

  const overlay = document.createElement("div");
  overlay.className = "minigameOverlay";
  overlay.innerHTML = `
    <div class="minigameBox" role="dialog" aria-label="Fix Wiring minigame">
      <button type="button" class="minigameClose" aria-label="Close">&times;</button>
      <h3>EMERGENCY TASK: FIX WIRING</h3>
      <p class="minigameHint">Connect each wire on the left to its matching color on the right.</p>
      <div class="wireRow">
        <div class="wireColumn" data-side="left"></div>
        <div class="wireColumn" data-side="right"></div>
      </div>
      <p class="minigameSuccess">Task Complete! ✅</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const leftCol = overlay.querySelector('[data-side="left"]');
  const rightCol = overlay.querySelector('[data-side="right"]');
  const successMsg = overlay.querySelector(".minigameSuccess");
  const closeBtn = overlay.querySelector(".minigameClose");

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
          }
        } else {
          dot.classList.add("wrong");
          selected.classList.add("wrong");
          setTimeout(() => {
            dot.classList.remove("wrong");
            selected.classList.remove("wrong", "selected");
            selected = null;
          }, 300);
        }
      });
    });
  }

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