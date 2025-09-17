import "./styles.css";

/**
 * Lógica:
 * - Desktop (≥1024px): nativo → scroll-x con snap (sin JS extra).
 * - Móvil/Tablet (<1024px): apilado tipo "deck".
 *   - Mostramos 1 card completa (activeIndex) y el resto detrás (z-index + scale).
 *   - Navegación: swipe (pointer events) izquierda↔derecha.
 *   - En la última card, ya no avanzamos a la derecha; solo se puede volver.
 */

const cardsEl = document.getElementById("cards") as HTMLElement;
const cardEls = Array.from(cardsEl.querySelectorAll<HTMLElement>(".card"));

/* Estado para móvil/tableta */
let activeIndex = 0;
let isPointerDown = false;
let startX = 0;
let deltaX = 0;
let swiped = false;
const SWIPE_THRESHOLD = 50; // px para cambiar de card

const isMobileOrTablet = () => window.matchMedia("(max-width: 1023px)").matches;
const isCoarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

/** Renderiza el "deck" en móvil/tableta seteando variables CSS por card */
function renderDeck() {
  if (!isMobileOrTablet()) {
    // Desktop: limpiar estilos in-line por si hubo cambio de tamaño
    cardEls.forEach((el) => {
      el.style.removeProperty("--x");
      el.style.removeProperty("--y");
      el.style.removeProperty("--scale");
      el.style.removeProperty("--z");
      el.style.removeProperty("--opacity");
      el.removeAttribute("aria-hidden");
    });
    return;
  }

  const depthMax = 3; // cuántas "detrás" visualizamos con degradado

  cardEls.forEach((el, i) => {
    const offset = i - activeIndex;

    if (offset < 0) {
      // Cards ya pasadas (a la izquierda): escóndelas
      el.style.setProperty("--x", "-120%");
      el.style.setProperty("--y", "0px");
      el.style.setProperty("--scale", "0.9");
      el.style.setProperty("--opacity", "0");
      el.style.setProperty("--z", "0");
      el.setAttribute("aria-hidden", "true");
      return;
    }

    // Card activa
    if (offset === 0) {
      el.style.setProperty("--x", "0px");
      el.style.setProperty("--y", "0px");
      el.style.setProperty("--scale", "1");
      el.style.setProperty("--opacity", "1");
      el.style.setProperty("--z", (depthMax + 5).toString());
      el.removeAttribute("aria-hidden");
      return;
    }

    // Cards detrás (offset 1, 2, 3, …)
    const depth = Math.min(offset, depthMax);
    const scale = 1 - depth * 0.06; // 0.94, 0.88, 0.82…
    const x = depth * 14;           // px a la derecha para indicar “detrás”
    const y = depth * 12;           // px hacia abajo para escalonado
    const opacity = Math.max(0, 1 - depth * 0.12);

    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.style.setProperty("--scale", `${scale}`);
    el.style.setProperty("--opacity", `${opacity}`);
    el.style.setProperty("--z", (depthMax - depth + 1).toString());
    el.removeAttribute("aria-hidden");
  });
}

/** Cambia de card con límites, respetando el comportamiento pedido */
function goTo(index: number) {
  const last = cardEls.length - 1;
  activeIndex = Math.max(0, Math.min(index, last));
  renderDeck();
}

/** Handlers de gesto (solo móvil/tableta con pointer coarse) */
function onPointerDown(e: PointerEvent) {
  if (!isMobileOrTablet() || !isCoarsePointer()) return;
  isPointerDown = true;
  swiped = false;
  startX = e.clientX;
  deltaX = 0;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isPointerDown || !isMobileOrTablet() || !isCoarsePointer()) return;
  deltaX = e.clientX - startX;

  // Pequeño arrastre visual de la card activa para feedback
  const activeCard = cardEls[activeIndex];
  if (activeCard) {
    const dragX = Math.max(-80, Math.min(80, deltaX)); // limitar ±80px
    activeCard.style.setProperty("--x", `${dragX}px`);
  }

  // Detectar swipe suficiente
  if (!swiped && Math.abs(deltaX) > SWIPE_THRESHOLD) {
    swiped = true;
    if (deltaX < 0) {
      // Desliza a la izquierda → siguiente (si no es la última)
      if (activeIndex < cardEls.length - 1) {
        goTo(activeIndex + 1);
      } else {
        // Estamos en la última: no avanzamos; regresamos visualmente al centro
        goTo(activeIndex);
      }
    } else {
      // Desliza a la derecha → anterior
      if (activeIndex > 0) {
        goTo(activeIndex - 1);
      } else {
        goTo(activeIndex);
      }
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isPointerDown) return;
  isPointerDown = false;

  // Si no alcanzó el umbral, reestablecer posición
  if (!swiped) {
    goTo(activeIndex);
  }
}

function bindMobileGesture() {
  // Limpia escuchas previas por seguridad
  cardsEl.removeEventListener("pointerdown", onPointerDown as any);
  window.removeEventListener("pointermove", onPointerMove as any);
  window.removeEventListener("pointerup", onPointerUp as any);
  window.removeEventListener("pointercancel", onPointerUp as any);
  window.removeEventListener("pointerleave", onPointerUp as any);

  if (isMobileOrTablet() && isCoarsePointer()) {
    cardsEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointerleave", onPointerUp);
  }
}

/** Init */
function init() {
  // En desktop el scroll es nativo; en móvil/tablet renderizamos el deck:
  renderDeck();
  bindMobileGesture();

  // Recalcular al cambiar el tamaño/orientación
  window.addEventListener("resize", () => {
    renderDeck();
    bindMobileGesture();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      renderDeck();
      bindMobileGesture();
    }, 50);
  });
}

init();

/* Accesibilidad: permite cambiar con flechas en teclado (útil en tablet con teclado) */
document.addEventListener("keydown", (e) => {
  if (!isMobileOrTablet()) return; // en desktop ya se puede hacer scroll con rueda/shift
  if (e.key === "ArrowLeft") {
    goTo(activeIndex - 1);
  } else if (e.key === "ArrowRight") {
    goTo(activeIndex + 1);
  }
});
