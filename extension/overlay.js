(function() {
	//#region src/context.ts
	/**
	* Runtime context for Promptotype overlay.
	* Abstracts where UI elements are appended (document.body vs Shadow DOM)
	* so the same overlay code works in proxy mode and extension mode.
	*/
	var uiRoot = null;
	var styleRoot = null;
	var shadowHost = null;
	/**
	* Initialize the context. Call once before any UI is created.
	* - In proxy/standalone mode: call with no args (defaults to document.body)
	* - In extension mode: call with the shadow root's container and the shadow root itself
	*/
	function initContext(options) {
		if (options) {
			uiRoot = options.uiRoot;
			styleRoot = options.styleRoot;
			shadowHost = options.shadowHost;
		} else {
			uiRoot = null;
			styleRoot = null;
			shadowHost = null;
		}
	}
	/** Where to append overlay UI elements (popovers, pins, panels, etc.) */
	function getUIRoot() {
		return uiRoot ?? document.body;
	}
	/** Where to inject overlay CSS (animations, scrollbars). Shadow root or document.head. */
	function getStyleRoot() {
		return styleRoot ?? document.head;
	}
	/** The shadow host element, if running in Shadow DOM mode. */
	function getShadowHost() {
		return shadowHost;
	}
	//#endregion
	//#region src/extract-styles.ts
	var _colorCanvas = null;
	var _colorCtx = null;
	function getColorCtx() {
		if (!_colorCtx) {
			_colorCanvas = document.createElement("canvas");
			_colorCanvas.width = 1;
			_colorCanvas.height = 1;
			_colorCtx = _colorCanvas.getContext("2d", { willReadFrequently: true });
		}
		return _colorCtx;
	}
	function rgbToHex(color) {
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) return "#" + [
			match[1],
			match[2],
			match[3]
		].map((v) => parseInt(v).toString(16).padStart(2, "0")).join("").toUpperCase();
		if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();
		try {
			const ctx = getColorCtx();
			if (ctx) {
				ctx.clearRect(0, 0, 1, 1);
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, 1, 1);
				const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
				return "#" + [
					r,
					g,
					b
				].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
			}
		} catch {}
		return color;
	}
	function extractStyles(el) {
		const computed = window.getComputedStyle(el);
		return {
			font: {
				family: computed.fontFamily.split(",")[0].replace(/['"]/g, "").trim(),
				size: computed.fontSize,
				weight: computed.fontWeight,
				lineHeight: computed.lineHeight
			},
			color: {
				text: rgbToHex(computed.color),
				background: rgbToHex(computed.backgroundColor)
			},
			spacing: {
				margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
				padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`
			},
			alignment: {
				textAlign: computed.textAlign,
				display: computed.display,
				alignItems: computed.alignItems,
				justifyContent: computed.justifyContent
			}
		};
	}
	/**
	* Extract source location from a DOM element.
	* Tries multiple strategies in order:
	* 1. data-pt-* attributes (companion Vite plugin)
	* 2. data-inspector-* attributes (react-dev-inspector)
	* 3. React Fiber _debugSource (React < 19, dev mode)
	*/
	function extractSourceLocation(el) {
		const ptFile = el.getAttribute("data-pt-file") || el.getAttribute("data-dev-file");
		const ptLine = el.getAttribute("data-pt-line") || el.getAttribute("data-dev-line");
		if (ptFile && ptLine) return {
			fileName: el.getAttribute("data-pt-path") || el.getAttribute("data-dev-path") || ptFile,
			lineNumber: parseInt(ptLine, 10),
			componentName: el.getAttribute("data-pt-component") || el.getAttribute("data-dev-component") || void 0
		};
		const inspectorPath = el.getAttribute("data-inspector-relative-path");
		const inspectorLine = el.getAttribute("data-inspector-line");
		if (inspectorPath && inspectorLine) return {
			fileName: inspectorPath,
			lineNumber: parseInt(inspectorLine, 10),
			columnNumber: parseInt(el.getAttribute("data-inspector-column") || "0", 10) || void 0
		};
		let current = el;
		while (current) {
			const source = getReactFiberSource(current);
			if (source) return source;
			current = current.parentElement;
		}
		return null;
	}
	/**
	* Read React Fiber _debugSource from a DOM element.
	* React attaches fibers with randomized keys like __reactFiber$abc123.
	*/
	function getReactFiberSource(el) {
		try {
			const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
			if (!fiberKey) return null;
			let fiber = el[fiberKey];
			let maxDepth = 15;
			while (fiber && maxDepth-- > 0) {
				if (fiber._debugSource) {
					const src = fiber._debugSource;
					return {
						fileName: src.fileName || src.file || "",
						lineNumber: src.lineNumber || src.line || 0,
						columnNumber: src.columnNumber || src.col || void 0,
						componentName: getComponentName(fiber)
					};
				}
				fiber = fiber._debugOwner || fiber.return;
			}
		} catch {}
		return null;
	}
	/** Extract component name from a React Fiber node. */
	function getComponentName(fiber) {
		try {
			if (!fiber?.type) return void 0;
			if (typeof fiber.type === "string") return fiber.type;
			return fiber.type.displayName || fiber.type.name || void 0;
		} catch {
			return;
		}
	}
	/** Extract CSS classes from an element, filtering out Promptotype's own classes. */
	function extractCssClasses(el) {
		if (!el.className || typeof el.className !== "string") return [];
		return el.className.trim().split(/\s+/).filter((c) => c && !c.startsWith("pt-"));
	}
	/** Extract meaningful text content from an element (first 100 chars, first text node only). */
	function extractTextContent(el) {
		let text = "";
		for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) {
			const t = node.textContent?.trim();
			if (t) {
				text = t;
				break;
			}
		}
		if (!text) text = el.innerText?.trim() || "";
		if (text.length > 100) text = text.slice(0, 100) + "...";
		return text;
	}
	/**
	* Capture a screenshot of an element.
	* In extension mode, this requests a capture from the background script
	* via a custom event. Returns null if not available.
	*/
	async function captureElementScreenshot(el) {
		try {
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return null;
			return new Promise((resolve) => {
				const requestId = "pt-capture-" + Date.now();
				const handler = (e) => {
					const detail = e.detail;
					if (detail?.requestId === requestId) {
						window.removeEventListener("__pt_screenshot_response", handler);
						resolve(detail.dataUrl || null);
					}
				};
				window.addEventListener("__pt_screenshot_response", handler);
				window.dispatchEvent(new CustomEvent("__pt_screenshot_request", { detail: {
					requestId,
					rect: {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height
					},
					dpr: window.devicePixelRatio || 1
				} }));
				setTimeout(() => {
					window.removeEventListener("__pt_screenshot_response", handler);
					resolve(null);
				}, 3e3);
			});
		} catch {
			return null;
		}
	}
	function generateSelector(el) {
		const tag = el.tagName.toLowerCase();
		const id = el.id ? `#${el.id}` : "";
		const classes = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).filter((c) => !c.startsWith("pt-")).slice(0, 2).join(".") : "";
		if (id) return `${tag}${id}`;
		if (classes && classes !== ".") return `${tag}${classes}`;
		return tag;
	}
	//#endregion
	//#region src/styles.ts
	var tokens = {
		color: {
			primary: {
				50: "#FAF5FF",
				100: "#F3E8FF",
				200: "#E9D5FF",
				300: "#D8B4FE",
				400: "#C084FC",
				500: "#A855F7",
				600: "#7C3AED",
				700: "#6D28D9",
				800: "#5B21B6",
				900: "#4C1D95"
			},
			surface: {
				base: "#161618",
				raised: "#1C1C1F",
				overlay: "#222225",
				elevated: "#2A2A2E",
				border: "#333338",
				borderSubtle: "#2A2A2E"
			},
			text: {
				primary: "#F0F0F2",
				secondary: "#A0A0A8",
				tertiary: "#6B6B74",
				inverse: "#161618"
			},
			success: "#34D399",
			warning: "#FBBF24",
			error: "#F87171",
			info: "#60A5FA",
			highlight: {
				border: "#A855F7",
				fill: "rgba(168, 85, 247, 0.08)",
				fillAnnotated: "rgba(168, 85, 247, 0.15)",
				margin: "rgba(249, 168, 37, 0.25)",
				padding: "rgba(52, 211, 153, 0.25)"
			}
		},
		space: {
			1: "4px",
			2: "8px",
			3: "12px",
			4: "16px",
			5: "20px",
			6: "24px",
			8: "32px",
			10: "40px",
			12: "48px"
		},
		font: {
			family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
			mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
			size: {
				xs: "11px",
				sm: "12px",
				base: "13px",
				md: "14px",
				lg: "16px"
			},
			weight: {
				regular: "400",
				medium: "500",
				semibold: "600",
				bold: "700"
			},
			lineHeight: {
				tight: "1.2",
				normal: "1.5",
				relaxed: "1.6"
			}
		},
		radius: {
			sm: "4px",
			md: "6px",
			lg: "8px",
			xl: "12px",
			full: "9999px"
		},
		shadow: {
			sm: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
			md: "0 4px 12px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)",
			lg: "0 8px 32px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)",
			xl: "0 16px 48px rgba(0,0,0,0.5)",
			glow: "0 0 20px rgba(168, 85, 247, 0.3)"
		},
		transition: {
			fast: "100ms ease-out",
			normal: "150ms ease-in-out",
			slow: "200ms ease-out",
			spring: "300ms cubic-bezier(0.34, 1.56, 0.64, 1)"
		},
		z: {
			highlight: 2147483638,
			highlightLabel: 2147483639,
			pins: 2147483640,
			breadcrumb: 2147483641,
			statusBar: 2147483642,
			popover: 2147483643,
			reviewPanel: 2147483644,
			toast: 2147483646
		}
	};
	function injectGlobalStyles() {
		const root = getStyleRoot();
		if (root instanceof ShadowRoot) {
			if (root.getElementById("pt-global-styles")) return;
		} else if (document.getElementById("pt-global-styles")) return;
		const style = document.createElement("style");
		style.id = "pt-global-styles";
		style.textContent = `
    @keyframes pt-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pt-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes pt-slide-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pt-slide-in-right {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes pt-slide-out-right {
      from { transform: translateX(0); }
      to { transform: translateX(100%); }
    }
    @keyframes pt-scale-in {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pt-pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
      100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
    }
    @keyframes pt-pulse-highlight {
      0% { opacity: 1; }
      100% { opacity: 0; transform: scale(1.02); }
    }
    @keyframes pt-shimmer {
      from { background-position: -200% 0; }
      to { background-position: 200% 0; }
    }
    @keyframes pt-toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    .pt-inspect-cursor, .pt-inspect-cursor * {
      cursor: crosshair !important;
    }

    /* Thin, transparent scrollbar — visible only on hover/scroll */
    [id^="pt-"] {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    [id^="pt-"]:hover {
      scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    [id^="pt-"]::-webkit-scrollbar {
      width: 5px;
    }
    [id^="pt-"]::-webkit-scrollbar-track {
      background: transparent;
    }
    [id^="pt-"]::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 3px;
    }
    [id^="pt-"]:hover::-webkit-scrollbar-thumb {
      background-color: rgba(255,255,255,0.15);
    }
    [id^="pt-"]::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255,255,255,0.3);
    }

    @media (prefers-reduced-motion: reduce) {
      [id^="pt-"], [class^="pt-"] {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
		root.appendChild(style);
		if (root !== document.head && !document.getElementById("pt-cursor-styles")) {
			const cursorStyle = document.createElement("style");
			cursorStyle.id = "pt-cursor-styles";
			cursorStyle.textContent = `
      .pt-inspect-cursor, .pt-inspect-cursor * {
        cursor: crosshair !important;
      }
    `;
			document.head.appendChild(cursorStyle);
		}
	}
	//#endregion
	//#region src/highlight-overlay.ts
	var OVERLAY_ID = "pt-highlight-overlay";
	var LABEL_ID = "pt-highlight-label";
	var MARGIN_ID = "pt-highlight-margin";
	var PADDING_ID = "pt-highlight-padding";
	var overlay = null;
	var label = null;
	var marginBox = null;
	var paddingBox = null;
	function ensureElements() {
		if (overlay) return;
		marginBox = document.createElement("div");
		marginBox.id = MARGIN_ID;
		marginBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    background: ${tokens.color.highlight.margin};
    display: none;
  `;
		getUIRoot().appendChild(marginBox);
		overlay = document.createElement("div");
		overlay.id = OVERLAY_ID;
		overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    border: 2px solid ${tokens.color.highlight.border};
    background: ${tokens.color.highlight.fill};
    transition: left ${tokens.transition.fast}, top ${tokens.transition.fast},
                width ${tokens.transition.fast}, height ${tokens.transition.fast};
    display: none;
  `;
		getUIRoot().appendChild(overlay);
		paddingBox = document.createElement("div");
		paddingBox.id = PADDING_ID;
		paddingBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    background: ${tokens.color.highlight.padding};
    display: none;
  `;
		getUIRoot().appendChild(paddingBox);
		label = document.createElement("div");
		label.id = LABEL_ID;
		label.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlightLabel};
    background: ${tokens.color.primary[600]};
    color: white;
    font: ${tokens.font.weight.medium} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    padding: 3px 8px;
    border-radius: ${tokens.radius.sm};
    white-space: nowrap;
    display: none;
    box-shadow: ${tokens.shadow.sm};
    letter-spacing: 0.2px;
  `;
		getUIRoot().appendChild(label);
	}
	function showHighlight(el, selector, isAnnotated) {
		ensureElements();
		const rect = el.getBoundingClientRect();
		const computed = window.getComputedStyle(el);
		const borderColor = isAnnotated ? tokens.color.primary[500] : tokens.color.highlight.border;
		const bgColor = isAnnotated ? tokens.color.highlight.fillAnnotated : tokens.color.highlight.fill;
		overlay.style.left = rect.left + "px";
		overlay.style.top = rect.top + "px";
		overlay.style.width = rect.width + "px";
		overlay.style.height = rect.height + "px";
		overlay.style.borderColor = borderColor;
		overlay.style.background = bgColor;
		overlay.style.display = "block";
		const mt = parseFloat(computed.marginTop) || 0;
		const mr = parseFloat(computed.marginRight) || 0;
		const mb = parseFloat(computed.marginBottom) || 0;
		const ml = parseFloat(computed.marginLeft) || 0;
		if ((mt || mr || mb || ml) && marginBox) {
			marginBox.style.left = rect.left - ml + "px";
			marginBox.style.top = rect.top - mt + "px";
			marginBox.style.width = rect.width + ml + mr + "px";
			marginBox.style.height = rect.height + mt + mb + "px";
			marginBox.style.display = "block";
			const innerL = ml;
			const innerT = mt;
			const innerR = ml + rect.width;
			const innerB = mt + rect.height;
			rect.width + ml + mr;
			rect.height + mt + mb;
			marginBox.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${innerL}px ${innerT}px, ${innerL}px ${innerB}px, ${innerR}px ${innerB}px, ${innerR}px ${innerT}px, ${innerL}px ${innerT}px
    )`;
		} else if (marginBox) marginBox.style.display = "none";
		const pt = parseFloat(computed.paddingTop) || 0;
		const pr = parseFloat(computed.paddingRight) || 0;
		const pb = parseFloat(computed.paddingBottom) || 0;
		const pl = parseFloat(computed.paddingLeft) || 0;
		if ((pt || pr || pb || pl) && paddingBox) {
			paddingBox.style.left = rect.left + "px";
			paddingBox.style.top = rect.top + "px";
			paddingBox.style.width = rect.width + "px";
			paddingBox.style.height = rect.height + "px";
			paddingBox.style.display = "block";
			const contentL = pl;
			const contentT = pt;
			const contentR = rect.width - pr;
			const contentB = rect.height - pb;
			paddingBox.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${contentL}px ${contentT}px, ${contentL}px ${contentB}px, ${contentR}px ${contentB}px, ${contentR}px ${contentT}px, ${contentL}px ${contentT}px
    )`;
		} else if (paddingBox) paddingBox.style.display = "none";
		if (label) {
			const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
			label.textContent = `${selector}  ${dims}`;
			label.style.left = rect.left + "px";
			label.style.top = Math.max(0, rect.top - 26) + "px";
			label.style.background = borderColor;
			label.style.display = "block";
		}
	}
	function hideHighlight() {
		if (overlay) overlay.style.display = "none";
		if (label) label.style.display = "none";
		if (marginBox) marginBox.style.display = "none";
		if (paddingBox) paddingBox.style.display = "none";
	}
	function pulseHighlight(el) {
		const rect = el.getBoundingClientRect();
		const pulse = document.createElement("div");
		pulse.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid ${tokens.color.primary[500]};
    background: rgba(168, 85, 247, 0.12);
    z-index: ${tokens.z.highlight};
    pointer-events: none;
    border-radius: ${tokens.radius.sm};
    animation: pt-pulse-highlight 0.6s ease-out forwards;
  `;
		getUIRoot().appendChild(pulse);
		setTimeout(() => pulse.remove(), 600);
	}
	function destroyHighlight() {
		overlay?.remove();
		label?.remove();
		marginBox?.remove();
		paddingBox?.remove();
		overlay = null;
		label = null;
		marginBox = null;
		paddingBox = null;
	}
	//#endregion
	//#region src/breadcrumb-bar.ts
	var BAR_ID$1 = "pt-breadcrumb-bar";
	var bar$1 = null;
	function ensureBar$1() {
		if (bar$1) return bar$1;
		bar$1 = document.createElement("div");
		bar$1.id = BAR_ID$1;
		bar$1.style.cssText = `
    position: fixed;
    bottom: 40px;
    left: 0;
    right: 0;
    z-index: ${tokens.z.breadcrumb};
    background: ${tokens.color.surface.base}F0;
    color: ${tokens.color.text.secondary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
    padding: ${tokens.space[2]} ${tokens.space[4]};
    display: none;
    overflow-x: auto;
    white-space: nowrap;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid ${tokens.color.surface.borderSubtle};
  `;
		getUIRoot().appendChild(bar$1);
		return bar$1;
	}
	function buildPath(el) {
		const path = [];
		let current = el;
		while (current && current !== document.body && current !== document.documentElement) {
			path.unshift(current);
			current = current.parentElement;
		}
		return path.slice(-6);
	}
	function tagLabel(el) {
		const tag = el.tagName.toLowerCase();
		const cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).filter((c) => !c.startsWith("pt-")).slice(0, 1).join(".") : "";
		return tag + (el.id ? `#${el.id}` : "") + (cls !== "." ? cls : "");
	}
	function updateBreadcrumb(el, onSelect) {
		const b = ensureBar$1();
		const path = buildPath(el);
		b.innerHTML = "";
		path.forEach((node, i) => {
			if (i > 0) {
				const sep = document.createElement("span");
				sep.textContent = "›";
				sep.style.cssText = `color: ${tokens.color.text.tertiary}; margin: 0 6px; font-size: 14px;`;
				b.appendChild(sep);
			}
			const span = document.createElement("span");
			span.textContent = tagLabel(node);
			const isLast = i === path.length - 1;
			span.style.cssText = `
      cursor: pointer;
      color: ${isLast ? tokens.color.primary[400] : tokens.color.text.secondary};
      font-weight: ${isLast ? tokens.font.weight.semibold : tokens.font.weight.regular};
      padding: 2px 4px;
      border-radius: ${tokens.radius.sm};
      transition: background ${tokens.transition.fast}, color ${tokens.transition.fast};
    `;
			span.addEventListener("mouseenter", () => {
				span.style.background = tokens.color.surface.elevated;
				if (!isLast) span.style.color = tokens.color.text.primary;
			});
			span.addEventListener("mouseleave", () => {
				span.style.background = "transparent";
				if (!isLast) span.style.color = tokens.color.text.secondary;
			});
			span.addEventListener("click", (e) => {
				e.stopPropagation();
				onSelect(node);
			});
			b.appendChild(span);
		});
		b.style.display = "block";
	}
	function hideBreadcrumb() {
		if (bar$1) bar$1.style.display = "none";
	}
	function destroyBreadcrumb() {
		bar$1?.remove();
		bar$1 = null;
	}
	//#endregion
	//#region src/tailwind.ts
	var TAILWIND_PATTERNS = {
		typography: [/^(text-(xs|sm|base|lg|xl|[2-9]xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono)|leading-|tracking-|line-clamp-|truncate|uppercase|lowercase|capitalize|normal-case|italic|not-italic|underline|overline|line-through|no-underline|antialiased|subpixel-antialiased)/],
		color: [
			/^(text|bg|border|ring|outline|accent|caret|fill|stroke|decoration|shadow)-(transparent|current|black|white|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|secondary|muted|accent|foreground|background|destructive|popover|card|input)/,
			/^(bg|text|border|ring)-\[#[0-9a-fA-F]+\]/,
			/^(bg|text|border|ring)-\[rgb/,
			/^(bg|text|border|ring)-\[hsl/,
			/^(bg|text|border|ring)-\[oklch/
		],
		spacing: [/^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|indent)-(0|px|[0-9]|auto|\[)/],
		sizing: [/^(w|h|min-w|min-h|max-w|max-h|size)-(0|px|full|screen|auto|min|max|fit|[0-9]|\[)/],
		layout: [
			/^(flex|grid|block|inline|hidden|contents|table|flow-root|inline-flex|inline-block|inline-grid)/,
			/^(flex-(row|col|wrap|nowrap|1|auto|initial|none)|grow|shrink|basis-|order-)/,
			/^(grid-cols-|grid-rows-|col-span-|row-span-|auto-cols-|auto-rows-)/,
			/^(justify-|items-|self-|content-|place-)/
		],
		position: [/^(relative|absolute|fixed|sticky|static|inset|top|right|bottom|left|z)-?/],
		border: [/^(border|rounded|divide|ring|outline)(-|$)/],
		effects: [/^(shadow|opacity|mix-blend|bg-blend|blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop-|drop-shadow)/],
		transitions: [/^(transition|duration|ease|delay|animate)-?/],
		overflow: [/^(overflow|overscroll)-/]
	};
	/** Check if a class looks like a Tailwind utility. */
	function matchCategory(cls) {
		const stripped = cls.replace(/^(sm|md|lg|xl|2xl|hover|focus|active|disabled|group-hover|dark|first|last|odd|even|placeholder|before|after|peer-|data-\[.*?\]):/, "");
		for (const [category, patterns] of Object.entries(TAILWIND_PATTERNS)) for (const pattern of patterns) if (pattern.test(stripped)) return category;
		if (/^[a-z]+-\[.+\]$/.test(stripped)) return "other-tailwind";
		if (/^-[a-z]+-/.test(stripped)) return matchCategory(stripped.slice(1));
		return null;
	}
	/** Detect if the page uses Tailwind (check for common markers). */
	function detectTailwind() {
		const styles = document.querySelectorAll("style, link[rel=\"stylesheet\"]");
		for (const el of styles) if (el instanceof HTMLStyleElement && el.textContent) {
			if (el.textContent.includes("--tw-") || el.textContent.includes("tailwindcss")) return true;
		}
		const root = getComputedStyle(document.documentElement);
		if (root.getPropertyValue("--tw-ring-offset-width") || root.getPropertyValue("--tw-shadow")) return true;
		return false;
	}
	var _isTailwind = null;
	/** Categorize an element's CSS classes into Tailwind groups. */
	function categorizeTailwindClasses(classes) {
		if (_isTailwind === null) _isTailwind = detectTailwind();
		if (!_isTailwind || classes.length === 0) return {
			detected: false,
			categories: {},
			other: classes
		};
		const categories = {};
		const other = [];
		for (const cls of classes) {
			const cat = matchCategory(cls);
			if (cat) {
				const key = cat === "other-tailwind" ? "other" : cat;
				if (!categories[key]) categories[key] = [];
				categories[key].push(cls);
			} else other.push(cls);
		}
		return {
			detected: true,
			categories,
			other
		};
	}
	//#endregion
	//#region src/annotation-popover.ts
	/** Ensure a color value is hex format for <input type="color">. */
	function toHexForPicker(color) {
		if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
		try {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext("2d", { willReadFrequently: true });
			if (ctx) {
				ctx.clearRect(0, 0, 1, 1);
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, 1, 1);
				const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
				return "#" + [
					r,
					g,
					b
				].map((v) => v.toString(16).padStart(2, "0")).join("");
			}
		} catch {}
		return "#000000";
	}
	var POPOVER_ID = "pt-annotation-popover";
	var popover = null;
	function inputStyle(extra = "") {
		return `
    width:100%;box-sizing:border-box;
    background:${tokens.color.surface.base};
    border:1px solid ${tokens.color.surface.border};
    border-radius:${tokens.radius.md};
    color:${tokens.color.text.primary};
    font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    padding:${tokens.space[2]} ${tokens.space[3]};
    outline:none;
    transition:border-color ${tokens.transition.fast};
    ${extra}
  `;
	}
	function sectionLabel(text) {
		return `<div style="
    color:${tokens.color.text.tertiary};
    font-size:${tokens.font.size.xs};
    font-weight:${tokens.font.weight.medium};
    text-transform:uppercase;
    letter-spacing:0.8px;
    margin-bottom:${tokens.space[1]};
  ">${text}</div>`;
	}
	var previewOriginals = null;
	var previewElement = null;
	function applyPreview(el, prop, value) {
		if (!previewOriginals) previewOriginals = /* @__PURE__ */ new Map();
		if (!previewOriginals.has(prop)) previewOriginals.set(prop, el.style[prop] || "");
		el.style[prop] = value;
		previewElement = el;
	}
	function revertPreview() {
		if (previewOriginals && previewElement) for (const [prop, original] of previewOriginals) if (prop === "__textContent") previewElement.textContent = original;
		else previewElement.style[prop] = original;
		previewOriginals = null;
		previewElement = null;
	}
	function showPopover(el, styles, existing, onSave, onCancel, source, cssClasses, textContent) {
		hidePopover();
		const rect = el.getBoundingClientRect();
		popover = document.createElement("div");
		popover.id = POPOVER_ID;
		let left = rect.right + 16;
		let top = rect.top;
		if (left + 360 > window.innerWidth) left = rect.left - 360 - 16;
		if (left < 12) {
			left = Math.max(12, rect.left);
			top = rect.bottom + 16;
		}
		if (top + 460 > window.innerHeight) top = Math.max(12, window.innerHeight - 480);
		if (top < 12) top = 12;
		const maxHeight = window.innerHeight - top - 12;
		popover.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: 360px;
    max-height: ${maxHeight}px;
    z-index: ${tokens.z.popover};
    background: ${tokens.color.surface.raised};
    color: ${tokens.color.text.primary};
    border: 1px solid ${tokens.color.surface.border};
    border-radius: ${tokens.radius.xl};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    box-shadow: ${tokens.shadow.xl};
    overflow-y: auto;
    animation: pt-scale-in 0.15s ease-out;
  `;
		const selector = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).filter((c) => !c.startsWith("pt-")).slice(0, 2).join(".") : "");
		const componentName = source?.componentName;
		const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
		const classes = cssClasses || [];
		const tw = categorizeTailwindClasses(classes);
		const existingChanges = existing?.changes || {};
		const headerHtml = `
    <div style="
      padding:${tokens.space[3]} ${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
    ">
      <div style="min-width:0;flex:1;">
        ${componentName ? `<div style="
          font-weight:${tokens.font.weight.semibold};
          color:${tokens.color.primary[400]};
          font-size:${tokens.font.size.sm};
        ">&lt;${componentName}&gt;</div>` : ""}
        <div style="
          color:${componentName ? tokens.color.text.tertiary : tokens.color.primary[400]};
          font-size:${tokens.font.size.xs};
          font-family:${tokens.font.mono};
          ${componentName ? "" : "font-weight:" + tokens.font.weight.semibold + ";"}
        ">${selector} · ${dims}</div>
        ${source ? `<div style="
          font-size:10px;
          font-family:${tokens.font.mono};
          color:${tokens.color.text.tertiary};
          margin-top:2px;
        ">${source.fileName}:${source.lineNumber}</div>` : ""}
      </div>
      <button id="pt-popover-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:24px;height:24px;
        border-radius:${tokens.radius.sm};
        display:flex;align-items:center;justify-content:center;
        font-size:14px;flex-shrink:0;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>
  `;
		const currentText = textContent || "";
		const textHtml = currentText ? `
    <div style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      ${sectionLabel("Text Content")}
      <input id="pt-edit-text" type="text" value="${currentText.replace(/"/g, "&quot;")}"
        style="${inputStyle("font-size:" + tokens.font.size.md + ";")}"
        placeholder="Element text"
      >
    </div>
  ` : "";
		const textColorHexVal = toHexForPicker(styles.color.text);
		const bgColorHexVal = toHexForPicker(styles.color.background);
		const colorsHtml = `
    <div style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      ${sectionLabel("Colors")}
      <div style="display:flex;gap:${tokens.space[3]};">
        <label style="flex:1;display:flex;align-items:center;gap:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
          <input id="pt-edit-text-color" type="color" value="${textColorHexVal}"
            style="width:28px;height:28px;border:1px solid ${tokens.color.surface.border};border-radius:${tokens.radius.sm};background:none;cursor:pointer;padding:0;">
          <span>Text</span>
          <span id="pt-text-color-hex" style="font-family:${tokens.font.mono};color:${tokens.color.text.tertiary};font-size:10px;">${textColorHexVal}</span>
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
          <input id="pt-edit-bg-color" type="color" value="${bgColorHexVal}"
            style="width:28px;height:28px;border:1px solid ${tokens.color.surface.border};border-radius:${tokens.radius.sm};background:none;cursor:pointer;padding:0;">
          <span>Background</span>
          <span id="pt-bg-color-hex" style="font-family:${tokens.font.mono};color:${tokens.color.text.tertiary};font-size:10px;">${bgColorHexVal}</span>
        </label>
      </div>
    </div>
  `;
		let classesHtml = "";
		if (tw.detected && classes.length > 0) {
			const allClasses = classes;
			const removedSet = new Set(existingChanges.removeClasses || []);
			const chips = allClasses.map((cls) => {
				const removed = removedSet.has(cls);
				return `<span class="pt-class-chip" data-class="${cls}" style="
        display:inline-flex;align-items:center;gap:4px;
        padding:2px 8px;
        border-radius:${tokens.radius.full};
        font-size:${tokens.font.size.xs};
        font-family:${tokens.font.mono};
        background:${removed ? tokens.color.surface.base : tokens.color.surface.elevated};
        color:${removed ? tokens.color.text.tertiary : tokens.color.text.secondary};
        border:1px solid ${removed ? tokens.color.error + "44" : tokens.color.surface.border};
        cursor:pointer;
        text-decoration:${removed ? "line-through" : "none"};
        transition:all ${tokens.transition.fast};
      ">
        ${cls}
        <span class="pt-chip-x" style="color:${tokens.color.text.tertiary};font-size:10px;line-height:1;">×</span>
      </span>`;
			}).join("");
			classesHtml = `
      <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
        <summary style="
          color:${tokens.color.text.tertiary};
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
          text-transform:uppercase;
          letter-spacing:0.8px;
          cursor:pointer;
          user-select:none;
        ">Tailwind Classes <span style="color:${tokens.color.text.tertiary};font-weight:${tokens.font.weight.regular};text-transform:none;letter-spacing:0;">(${allClasses.length})</span></summary>
        <div id="pt-class-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:${tokens.space[2]};margin-bottom:${tokens.space[2]};">
          ${chips}
        </div>
        <div style="display:flex;gap:${tokens.space[2]};">
          <input id="pt-add-class" type="text" placeholder="Add class..."
            style="${inputStyle("flex:1;font-family:" + tokens.font.mono + ";font-size:" + tokens.font.size.xs + ";padding:4px 8px;")}"
          >
        </div>
      </details>
    `;
		} else if (classes.length > 0) classesHtml = `
      <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
        <summary style="
          color:${tokens.color.text.tertiary};
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
          cursor:pointer;
          user-select:none;
        ">Classes (${classes.length})</summary>
        <div style="margin-top:${tokens.space[2]};font-size:${tokens.font.size.xs};font-family:${tokens.font.mono};color:${tokens.color.text.secondary};word-break:break-all;">
          ${classes.join(" ")}
        </div>
      </details>
    `;
		const miniInput = (id, value, width = "60px") => `
    <input id="${id}" type="text" value="${value}"
      style="width:${width};background:${tokens.color.surface.base};border:1px solid ${tokens.color.surface.border};
      border-radius:${tokens.radius.sm};color:${tokens.color.text.primary};
      font:${tokens.font.weight.regular} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
      padding:2px 6px;outline:none;text-align:center;
      transition:border-color ${tokens.transition.fast};">
  `;
		const styleRow = (label, content) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};width:52px;flex-shrink:0;">${label}</span>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${content}</div>
    </div>
  `;
		const computedHtml = `
    <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      <summary style="
        color:${tokens.color.text.tertiary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        cursor:pointer;
        user-select:none;
      ">Styles</summary>
      <div style="margin-top:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
        ${styleRow("Font", `
          <span style="color:${tokens.color.text.tertiary};">${styles.font.family}</span>
          ${miniInput("pt-edit-font-size", styles.font.size, "52px")}
          ${miniInput("pt-edit-font-weight", styles.font.weight, "44px")}
          <span style="color:${tokens.color.text.tertiary};">/</span>
          ${miniInput("pt-edit-line-height", styles.font.lineHeight, "52px")}
        `)}
        ${styleRow("Margin", miniInput("pt-edit-margin", styles.spacing.margin, "100%"))}
        ${styleRow("Padding", miniInput("pt-edit-padding", styles.spacing.padding, "100%"))}
        ${styleRow("Layout", `
          <span style="color:${tokens.color.text.secondary};font-family:${tokens.font.mono};">
            ${styles.alignment.display} · ${styles.alignment.textAlign} · align: ${styles.alignment.alignItems}
          </span>
        `)}
      </div>
    </details>
  `;
		const promptHtml = `
    <div style="padding:${tokens.space[4]};">
      ${sectionLabel("Additional Instructions (optional)")}
      <textarea
        id="pt-prompt"
        rows="2"
        placeholder="Anything else the AI should know..."
        style="${inputStyle("resize:vertical;font-size:" + tokens.font.size.sm + ";")}"
      >${existing?.prompt ?? ""}</textarea>

      <div style="
        margin-top:${tokens.space[4]};
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">
          <kbd style="
            background:${tokens.color.surface.elevated};
            border:1px solid ${tokens.color.surface.border};
            border-radius:${tokens.radius.sm};
            padding:1px 4px;
            font-size:10px;
          ">⌘↵</kbd> to save
        </span>
        <div style="display:flex;gap:${tokens.space[2]};">
          <button id="pt-popover-cancel" style="
            background:transparent;
            border:1px solid ${tokens.color.surface.border};
            border-radius:${tokens.radius.md};
            color:${tokens.color.text.secondary};
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
          ">Cancel</button>
          <button id="pt-popover-save" style="
            background:${tokens.color.primary[600]};
            border:none;
            border-radius:${tokens.radius.md};
            color:white;
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, transform ${tokens.transition.fast};
          ">${existing ? "Update" : "Save"}</button>
        </div>
      </div>
    </div>
  `;
		popover.innerHTML = headerHtml + textHtml + colorsHtml + classesHtml + computedHtml + promptHtml;
		getUIRoot().appendChild(popover);
		const textarea = popover.querySelector("#pt-prompt");
		const closeBtn = popover.querySelector("#pt-popover-close");
		const cancelBtn = popover.querySelector("#pt-popover-cancel");
		const saveBtn = popover.querySelector("#pt-popover-save");
		const textInput = popover.querySelector("#pt-edit-text");
		const textColorInput = popover.querySelector("#pt-edit-text-color");
		const bgColorInput = popover.querySelector("#pt-edit-bg-color");
		const textColorHex = popover.querySelector("#pt-text-color-hex");
		const bgColorHex = popover.querySelector("#pt-bg-color-hex");
		const addClassInput = popover.querySelector("#pt-add-class");
		const removedClasses = new Set(existingChanges.removeClasses || []);
		const addedClasses = [...existingChanges.addClasses || []];
		setTimeout(() => (textInput || textarea).focus(), 50);
		textColorInput?.addEventListener("input", () => {
			textColorHex.textContent = textColorInput.value.toUpperCase();
			applyPreview(el, "color", textColorInput.value);
		});
		bgColorInput?.addEventListener("input", () => {
			bgColorHex.textContent = bgColorInput.value.toUpperCase();
			applyPreview(el, "backgroundColor", bgColorInput.value);
		});
		const originalTextContent = el.textContent || "";
		textInput?.addEventListener("input", () => {
			if (el.childNodes.length <= 1 || el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
				if (!previewOriginals) previewOriginals = /* @__PURE__ */ new Map();
				if (!previewOriginals.has("__textContent")) {
					previewOriginals.set("__textContent", originalTextContent);
					previewElement = el;
				}
				el.textContent = textInput.value;
			}
		});
		for (const [inputId, cssProp] of Object.entries({
			"pt-edit-font-size": "fontSize",
			"pt-edit-font-weight": "fontWeight",
			"pt-edit-line-height": "lineHeight"
		})) {
			const input = popover.querySelector(`#${inputId}`);
			input?.addEventListener("input", () => {
				if (input.value.trim()) applyPreview(el, cssProp, input.value.trim());
			});
		}
		const marginInput = popover.querySelector("#pt-edit-margin");
		marginInput?.addEventListener("input", () => {
			if (marginInput.value.trim()) applyPreview(el, "margin", marginInput.value.trim());
		});
		const paddingInput = popover.querySelector("#pt-edit-padding");
		paddingInput?.addEventListener("input", () => {
			if (paddingInput.value.trim()) applyPreview(el, "padding", paddingInput.value.trim());
		});
		popover.querySelectorAll(".pt-class-chip").forEach((chip) => {
			chip.addEventListener("click", () => {
				const cls = chip.dataset.class;
				if (removedClasses.has(cls)) {
					removedClasses.delete(cls);
					chip.style.textDecoration = "none";
					chip.style.background = tokens.color.surface.elevated;
					chip.style.color = tokens.color.text.secondary;
					chip.style.borderColor = tokens.color.surface.border;
				} else {
					removedClasses.add(cls);
					chip.style.textDecoration = "line-through";
					chip.style.background = tokens.color.surface.base;
					chip.style.color = tokens.color.text.tertiary;
					chip.style.borderColor = tokens.color.error + "44";
				}
			});
		});
		addClassInput?.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const cls = addClassInput.value.trim();
				if (cls && !addedClasses.includes(cls)) {
					addedClasses.push(cls);
					const chip = document.createElement("span");
					chip.className = "pt-class-chip";
					chip.style.cssText = `
          display:inline-flex;align-items:center;gap:4px;
          padding:2px 8px;border-radius:${tokens.radius.full};
          font-size:${tokens.font.size.xs};font-family:${tokens.font.mono};
          background:${tokens.color.primary[600]}22;
          color:${tokens.color.primary[400]};
          border:1px solid ${tokens.color.primary[600]}44;
        `;
					chip.innerHTML = `+ ${cls} <span class="pt-chip-x" style="color:${tokens.color.text.tertiary};font-size:10px;cursor:pointer;">×</span>`;
					chip.querySelector(".pt-chip-x").addEventListener("click", () => {
						const idx = addedClasses.indexOf(cls);
						if (idx !== -1) addedClasses.splice(idx, 1);
						chip.remove();
					});
					popover.querySelector("#pt-class-chips")?.appendChild(chip);
					addClassInput.value = "";
				}
			}
		});
		const getVal = (id) => popover.querySelector(id)?.value?.trim() || "";
		function collectChanges() {
			const changes = {};
			if (textInput && textInput.value !== currentText) changes.text = textInput.value;
			if (textColorInput.value.toUpperCase() !== textColorHexVal.toUpperCase()) changes.textColor = textColorInput.value.toUpperCase();
			if (bgColorInput.value.toUpperCase() !== bgColorHexVal.toUpperCase()) changes.bgColor = bgColorInput.value.toUpperCase();
			const newFontSize = getVal("#pt-edit-font-size");
			if (newFontSize && newFontSize !== styles.font.size) changes.fontSize = newFontSize;
			const newFontWeight = getVal("#pt-edit-font-weight");
			if (newFontWeight && newFontWeight !== styles.font.weight) changes.fontWeight = newFontWeight;
			const newLineHeight = getVal("#pt-edit-line-height");
			if (newLineHeight && newLineHeight !== styles.font.lineHeight) changes.lineHeight = newLineHeight;
			const newMargin = getVal("#pt-edit-margin");
			if (newMargin && newMargin !== styles.spacing.margin) changes.margin = newMargin;
			const newPadding = getVal("#pt-edit-padding");
			if (newPadding && newPadding !== styles.spacing.padding) changes.padding = newPadding;
			if (removedClasses.size > 0) changes.removeClasses = [...removedClasses];
			if (addedClasses.length > 0) changes.addClasses = [...addedClasses];
			return changes;
		}
		closeBtn.addEventListener("mouseenter", () => {
			closeBtn.style.background = tokens.color.surface.overlay;
			closeBtn.style.color = tokens.color.text.primary;
		});
		closeBtn.addEventListener("mouseleave", () => {
			closeBtn.style.background = tokens.color.surface.elevated;
			closeBtn.style.color = tokens.color.text.tertiary;
		});
		closeBtn.addEventListener("click", () => {
			revertPreview();
			onCancel();
		});
		cancelBtn.addEventListener("mouseenter", () => {
			cancelBtn.style.background = tokens.color.surface.elevated;
			cancelBtn.style.borderColor = tokens.color.text.tertiary;
		});
		cancelBtn.addEventListener("mouseleave", () => {
			cancelBtn.style.background = "transparent";
			cancelBtn.style.borderColor = tokens.color.surface.border;
		});
		cancelBtn.addEventListener("click", () => {
			revertPreview();
			onCancel();
		});
		saveBtn.addEventListener("mouseenter", () => {
			saveBtn.style.background = tokens.color.primary[700];
			saveBtn.style.transform = "translateY(-1px)";
		});
		saveBtn.addEventListener("mouseleave", () => {
			saveBtn.style.background = tokens.color.primary[600];
			saveBtn.style.transform = "translateY(0)";
		});
		saveBtn.addEventListener("mousedown", () => {
			saveBtn.style.transform = "scale(0.98)";
		});
		saveBtn.addEventListener("mouseup", () => {
			saveBtn.style.transform = "translateY(-1px)";
		});
		saveBtn.addEventListener("click", () => {
			const prompt = textarea.value.trim();
			const changes = collectChanges();
			revertPreview();
			onSave(prompt, changes.bgColor || changes.textColor || existing?.colorSuggestion || "", changes);
		});
		popover.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				saveBtn.click();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				revertPreview();
				onCancel();
			}
		});
	}
	function hidePopover() {
		revertPreview();
		popover?.remove();
		popover = null;
	}
	function isPopoverOpen() {
		return popover !== null;
	}
	//#endregion
	//#region src/pin-markers.ts
	var PIN_CLASS = "pt-pin-marker";
	var pins = /* @__PURE__ */ new Map();
	function addPin(annotation, index) {
		removePin(annotation.id);
		const rect = annotation.element.getBoundingClientRect();
		const pin = document.createElement("div");
		pin.className = PIN_CLASS;
		pin.dataset.annotationId = annotation.id;
		pin.style.cssText = `
    position: fixed;
    left: ${rect.right - 12}px;
    top: ${rect.top - 12}px;
    width: 24px;
    height: 24px;
    background: ${tokens.color.primary[600]};
    color: white;
    border-radius: ${tokens.radius.full};
    font: ${tokens.font.weight.bold} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${tokens.z.pins};
    pointer-events: auto;
    cursor: pointer;
    box-shadow: ${tokens.shadow.md}, 0 0 0 2px ${tokens.color.surface.base};
    transition: transform ${tokens.transition.spring}, box-shadow ${tokens.transition.normal};
    animation: pt-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
		pin.textContent = String(index + 1);
		pin.title = annotation.prompt ? annotation.prompt.slice(0, 60) + (annotation.prompt.length > 60 ? "..." : "") : annotation.colorSuggestion ? `Color: ${annotation.colorSuggestion}` : "Properties captured";
		pin.addEventListener("mouseenter", () => {
			pin.style.transform = "scale(1.15)";
			pin.style.boxShadow = `${tokens.shadow.lg}, ${tokens.shadow.glow}, 0 0 0 2px ${tokens.color.surface.base}`;
		});
		pin.addEventListener("mouseleave", () => {
			pin.style.transform = "scale(1)";
			pin.style.boxShadow = `${tokens.shadow.md}, 0 0 0 2px ${tokens.color.surface.base}`;
		});
		getUIRoot().appendChild(pin);
		pins.set(annotation.id, pin);
	}
	function removePin(id) {
		const pin = pins.get(id);
		if (pin) {
			pin.remove();
			pins.delete(id);
		}
	}
	function updateAllPins(annotations) {
		clearAllPins();
		annotations.forEach((a, i) => addPin(a, i));
	}
	function clearAllPins() {
		pins.forEach((pin) => pin.remove());
		pins.clear();
	}
	function onPinClick(handler) {
		document.addEventListener("click", (e) => {
			const pin = e.target.closest(`.${PIN_CLASS}`);
			if (pin?.dataset.annotationId) {
				e.stopPropagation();
				handler(pin.dataset.annotationId);
			}
		}, true);
	}
	//#endregion
	//#region src/status-bar.ts
	var BAR_ID = "pt-status-bar";
	var bar = null;
	function ensureBar() {
		if (bar) return bar;
		bar = document.createElement("div");
		bar.id = BAR_ID;
		bar.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: ${tokens.z.statusBar};
    background: ${tokens.color.surface.base}F2;
    color: ${tokens.color.text.secondary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    padding: ${tokens.space[3]} ${tokens.space[5]};
    display: flex;
    align-items: center;
    gap: ${tokens.space[3]};
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid ${tokens.color.surface.borderSubtle};
    animation: pt-slide-up 0.2s ease-out;
  `;
		getUIRoot().appendChild(bar);
		return bar;
	}
	var logoSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
  <circle cx="8" cy="8" r="2" fill="currentColor"/>
  <line x1="13" y1="8" x2="19" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="7" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="7" y1="17" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;
	function updateStatusBar(count, onReview, onExit) {
		const b = ensureBar();
		b.innerHTML = `
    <div style="display:flex;align-items:center;gap:${tokens.space[2]};">
      <div style="
        color: ${tokens.color.primary[400]};
        display: flex;
        align-items: center;
      ">${logoSVG}</div>
      <span style="
        color: ${tokens.color.text.primary};
        font-weight: ${tokens.font.weight.semibold};
        font-size: ${tokens.font.size.sm};
        letter-spacing: 0.3px;
      ">Promptotype</span>
    </div>

    <div style="width:1px;height:16px;background:${tokens.color.surface.border};"></div>

    <span style="color:${tokens.color.text.secondary};font-size:${tokens.font.size.sm};">
      ${count === 0 ? "Click elements to annotate" : `<span style="
            display:inline-flex;
            align-items:center;
            gap:${tokens.space[1]};
          ">
            <span style="
              background:${tokens.color.primary[600]};
              color:white;
              min-width:20px;
              height:20px;
              border-radius:${tokens.radius.full};
              display:inline-flex;
              align-items:center;
              justify-content:center;
              font-size:${tokens.font.size.xs};
              font-weight:${tokens.font.weight.bold};
            ">${count}</span>
            annotation${count !== 1 ? "s" : ""}
          </span>`}
    </span>

    <div style="flex:1;"></div>

    <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">
      <kbd style="
        background:${tokens.color.surface.elevated};
        border:1px solid ${tokens.color.surface.border};
        border-radius:${tokens.radius.sm};
        padding:1px 5px;
        font-size:${tokens.font.size.xs};
        font-family:${tokens.font.family};
      ">Esc</kbd> to exit
    </span>

    ${count > 0 ? `
      <button id="pt-review-btn" style="
        background: ${tokens.color.primary[600]};
        color: white;
        border: none;
        border-radius: ${tokens.radius.md};
        padding: ${tokens.space[2]} ${tokens.space[4]};
        font: ${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
        cursor: pointer;
        transition: background ${tokens.transition.fast}, transform ${tokens.transition.fast};
        display: flex;
        align-items: center;
        gap: ${tokens.space[2]};
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Review & Submit
      </button>
    ` : ""}
  `;
		if (count > 0) {
			const btn = b.querySelector("#pt-review-btn");
			btn.addEventListener("click", onReview);
			btn.addEventListener("mouseenter", () => {
				btn.style.background = tokens.color.primary[700];
				btn.style.transform = "translateY(-1px)";
			});
			btn.addEventListener("mouseleave", () => {
				btn.style.background = tokens.color.primary[600];
				btn.style.transform = "translateY(0)";
			});
			btn.addEventListener("mousedown", () => {
				btn.style.transform = "translateY(0) scale(0.98)";
			});
			btn.addEventListener("mouseup", () => {
				btn.style.transform = "translateY(-1px)";
			});
		}
	}
	function destroyStatusBar() {
		bar?.remove();
		bar = null;
	}
	//#endregion
	//#region src/output.ts
	function generateMarkdown(annotations) {
		let md = `## Design Annotations (${annotations.length} element${annotations.length !== 1 ? "s" : ""})\n\n`;
		annotations.forEach((a, i) => {
			const s = a.styles;
			md += `### ${i + 1}. \`${a.selector}\`\n`;
			if (a.source) {
				const loc = `${a.source.fileName}:${a.source.lineNumber}`;
				const comp = a.source.componentName ? ` (${a.source.componentName})` : "";
				md += `**Source:** \`${loc}\`${comp}\n`;
			}
			if (a.textContent) md += `**Text:** "${a.textContent}"\n`;
			if (a.cssClasses.length > 0) {
				const tw = categorizeTailwindClasses(a.cssClasses);
				if (tw.detected && Object.keys(tw.categories).length > 0) {
					md += `**Tailwind classes:**\n`;
					for (const [cat, classes] of Object.entries(tw.categories)) md += `- ${cat}: \`${classes.join(" ")}\`\n`;
					if (tw.other.length > 0) md += `- custom: \`${tw.other.join(" ")}\`\n`;
				} else md += `**Classes:** \`${a.cssClasses.join(" ")}\`\n`;
			}
			md += `**Current styles:**\n`;
			md += `- Font: ${s.font.family}, ${s.font.size}, weight ${s.font.weight}, line-height ${s.font.lineHeight}\n`;
			md += `- Color: ${s.color.text} (on background ${s.color.background})\n`;
			md += `- Margin: ${s.spacing.margin}\n`;
			md += `- Padding: ${s.spacing.padding}\n`;
			md += `- Alignment: ${s.alignment.textAlign}, ${s.alignment.display}, align-items: ${s.alignment.alignItems}\n`;
			md += `\n`;
			const c = a.changes;
			const hasChanges = c && (c.text || c.textColor || c.bgColor || c.fontSize || c.fontWeight || c.lineHeight || c.margin || c.padding || c.removeClasses?.length || c.addClasses?.length);
			if (hasChanges) {
				md += `**Changes:**\n`;
				if (c.text !== void 0) md += `- Text: "${a.textContent}" → "${c.text}"\n`;
				if (c.textColor) md += `- Text color: ${a.styles.color.text} → ${c.textColor}\n`;
				if (c.bgColor) md += `- Background: ${a.styles.color.background} → ${c.bgColor}\n`;
				if (c.fontSize) md += `- Font size: ${a.styles.font.size} → ${c.fontSize}\n`;
				if (c.fontWeight) md += `- Font weight: ${a.styles.font.weight} → ${c.fontWeight}\n`;
				if (c.lineHeight) md += `- Line height: ${a.styles.font.lineHeight} → ${c.lineHeight}\n`;
				if (c.margin) md += `- Margin: ${a.styles.spacing.margin} → ${c.margin}\n`;
				if (c.padding) md += `- Padding: ${a.styles.spacing.padding} → ${c.padding}\n`;
				if (c.removeClasses?.length) md += `- Remove classes: \`${c.removeClasses.join(" ")}\`\n`;
				if (c.addClasses?.length) md += `- Add classes: \`${c.addClasses.join(" ")}\`\n`;
				md += `\n`;
			}
			if (a.prompt) md += `**Prompt:** ${a.prompt}\n`;
			if (!a.prompt && !hasChanges) md += `**Prompt:** Review this element\n`;
			md += `\n---\n\n`;
		});
		return md.trim();
	}
	async function copyToClipboard(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.cssText = "position:fixed;opacity:0;";
			getUIRoot().appendChild(textarea);
			textarea.select();
			const success = document.execCommand("copy");
			textarea.remove();
			return success;
		}
	}
	/**
	* Check if we're running through the Promptotype proxy.
	*/
	function isProxyMode() {
		return !!window.__PT_PROXY__;
	}
	/**
	* Check if the MCP server is reachable (extension mode).
	*/
	function isMcpMode() {
		return !!window.__PT_MCP__;
	}
	/**
	* Submit annotations to the proxy server's API endpoint.
	* Returns true if successful, false otherwise.
	*/
	async function submitToProxy(markdown) {
		try {
			const origin = window.__PT_PROXY_ORIGIN__ || window.location.origin;
			const token = window.__PT_SESSION_TOKEN__ || "";
			return (await fetch(`${origin}/__pt__/api/annotations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					markdown,
					token
				})
			})).ok;
		} catch {
			return false;
		}
	}
	/**
	* Submit annotations to the local MCP server (extension mode).
	* Returns true if successful, false otherwise.
	*/
	/**
	* Signal to the MCP server that the annotation session has ended.
	* Resolves any pending wait_for_annotations() with a close signal.
	*/
	async function signalMcpClose() {
		try {
			const port = window.__PT_MCP_PORT__ || 4100;
			await fetch(`http://localhost:${port}/__pt__/api/close`, {
				method: "POST",
				headers: { "Content-Type": "application/json" }
			});
		} catch {}
	}
	async function submitToMcp(markdown) {
		try {
			const port = window.__PT_MCP_PORT__ || 4100;
			return (await fetch(`http://localhost:${port}/__pt__/api/annotations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ markdown })
			})).ok;
		} catch {
			return false;
		}
	}
	//#endregion
	//#region src/review-panel.ts
	var PANEL_ID = "pt-review-panel";
	var panel = null;
	function colorDot(hex) {
		return `<span style="
    display:inline-block;width:10px;height:10px;
    background:${hex};border-radius:${tokens.radius.full};
    border:1px solid rgba(255,255,255,0.15);vertical-align:middle;
  "></span>`;
	}
	function changeLine(label, from, to, fromDot, toDot) {
		return `<div style="font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};margin-bottom:2px;">
    <span style="color:${tokens.color.text.tertiary};">${label}:</span>
    ${fromDot || ""}<span style="text-decoration:line-through;opacity:0.6;">${from}</span>
    <span style="color:${tokens.color.text.tertiary};">→</span>
    ${toDot || ""}<span style="color:${tokens.color.primary[400]};">${to}</span>
  </div>`;
	}
	function renderChanges(a) {
		const c = a.changes;
		if (!c) return "";
		const lines = [];
		if (c.text !== void 0) lines.push(changeLine("Text", `"${a.textContent}"`, `"${c.text}"`));
		if (c.textColor) lines.push(changeLine("Text", a.styles.color.text, c.textColor, colorDot(a.styles.color.text) + " ", colorDot(c.textColor) + " "));
		if (c.bgColor) lines.push(changeLine("Bg", a.styles.color.background, c.bgColor, colorDot(a.styles.color.background) + " ", colorDot(c.bgColor) + " "));
		if (c.fontSize) lines.push(changeLine("Size", a.styles.font.size, c.fontSize));
		if (c.fontWeight) lines.push(changeLine("Weight", a.styles.font.weight, c.fontWeight));
		if (c.lineHeight) lines.push(changeLine("Height", a.styles.font.lineHeight, c.lineHeight));
		if (c.margin) lines.push(changeLine("Margin", a.styles.spacing.margin, c.margin));
		if (c.padding) lines.push(changeLine("Padding", a.styles.spacing.padding, c.padding));
		if (c.removeClasses?.length) lines.push(`<div style="font-size:${tokens.font.size.xs};color:${tokens.color.error};margin-bottom:2px;">
      <span style="color:${tokens.color.text.tertiary};">Remove:</span>
      <span style="font-family:${tokens.font.mono};">${c.removeClasses.join(" ")}</span>
    </div>`);
		if (c.addClasses?.length) lines.push(`<div style="font-size:${tokens.font.size.xs};color:${tokens.color.success};margin-bottom:2px;">
      <span style="color:${tokens.color.text.tertiary};">Add:</span>
      <span style="font-family:${tokens.font.mono};">${c.addClasses.join(" ")}</span>
    </div>`);
		return lines.length > 0 ? lines.join("") : "";
	}
	function compactProps(a) {
		const changes = renderChanges(a);
		if (changes) return changes;
		const s = a.styles;
		return `<span style="font-family:${tokens.font.mono};font-size:${tokens.font.size.xs};">
    ${s.font.family} ${s.font.size} · ${s.font.weight}
  </span>
  <span style="color:${tokens.color.text.tertiary};margin:0 4px;">·</span>
  ${colorDot(s.color.text)} ${colorDot(s.color.background)}`;
	}
	function showReviewPanel(annotations, onEdit, onDelete, onCopy, onBack) {
		hideReviewPanel();
		panel = document.createElement("div");
		panel.id = PANEL_ID;
		panel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    z-index: ${tokens.z.reviewPanel};
    background: ${tokens.color.surface.base};
    color: ${tokens.color.text.primary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    border-left: 1px solid ${tokens.color.surface.border};
    display: flex;
    flex-direction: column;
    box-shadow: ${tokens.shadow.xl};
    animation: pt-slide-in-right 0.25s ease-out;
  `;
		const header = `
    <div style="
      padding:${tokens.space[4]} ${tokens.space[5]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:center;
      flex-shrink:0;
    ">
      <div style="display:flex;align-items:center;gap:${tokens.space[3]};">
        <span style="font-weight:${tokens.font.weight.semibold};font-size:${tokens.font.size.md};">Review</span>
        <span style="
          background:${tokens.color.surface.elevated};
          color:${tokens.color.text.secondary};
          border-radius:${tokens.radius.full};
          padding:2px 8px;
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
        ">${annotations.length} annotation${annotations.length !== 1 ? "s" : ""}</span>
      </div>
      <button id="pt-review-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:28px;height:28px;
        border-radius:${tokens.radius.md};
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>
  `;
		let cardsHtml = "";
		if (annotations.length === 0) cardsHtml = `
      <div style="
        flex:1;display:flex;align-items:center;justify-content:center;
        color:${tokens.color.text.tertiary};text-align:center;padding:${tokens.space[8]};
      ">
        <div>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${tokens.color.text.tertiary}" stroke-width="1.5" style="margin:0 auto ${tokens.space[4]};display:block;opacity:0.5;">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8" cy="8" r="2"/>
            <line x1="13" y1="8" x2="19" y2="8" stroke-linecap="round"/>
            <line x1="7" y1="13" x2="17" y2="13" stroke-linecap="round"/>
            <line x1="7" y1="17" x2="14" y2="17" stroke-linecap="round"/>
          </svg>
          <div style="font-size:${tokens.font.size.md};font-weight:${tokens.font.weight.medium};color:${tokens.color.text.secondary};margin-bottom:${tokens.space[1]};">No annotations yet</div>
          <div style="font-size:${tokens.font.size.sm};color:${tokens.color.text.tertiary};">Go back and click elements to annotate them</div>
        </div>
      </div>
    `;
		else {
			cardsHtml = `<div style="flex:1;overflow-y:auto;padding:${tokens.space[3]};">`;
			annotations.forEach((a, i) => {
				const promptText = a.prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
				cardsHtml += `
        <div class="pt-review-card" data-id="${a.id}" style="
          background:${tokens.color.surface.raised};
          border:1px solid ${tokens.color.surface.border};
          border-radius:${tokens.radius.lg};
          padding:${tokens.space[4]};
          margin-bottom:${tokens.space[2]};
          cursor:pointer;
          transition:border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast};
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${tokens.space[3]};">
            <div style="display:flex;align-items:center;gap:${tokens.space[2]};">
              <span style="
                background:${tokens.color.primary[600]};
                color:white;
                width:22px;height:22px;
                border-radius:${tokens.radius.full};
                font-size:${tokens.font.size.xs};
                font-weight:${tokens.font.weight.bold};
                display:flex;align-items:center;justify-content:center;
              ">${i + 1}</span>
              <span style="
                color:${tokens.color.primary[400]};
                font-weight:${tokens.font.weight.medium};
                font-size:${tokens.font.size.sm};
                font-family:${tokens.font.mono};
              ">${a.selector}</span>
              ${a.textContent ? `<span style="
                color:${tokens.color.text.tertiary};
                font-size:${tokens.font.size.xs};
                max-width:120px;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              ">"${a.textContent.slice(0, 30)}"</span>` : ""}
            </div>
            <button class="pt-delete-btn" data-id="${a.id}" style="
              background:transparent;
              border:none;
              color:${tokens.color.text.tertiary};
              cursor:pointer;
              width:24px;height:24px;
              border-radius:${tokens.radius.sm};
              display:flex;align-items:center;justify-content:center;
              font-size:14px;
              transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
            ">×</button>
          </div>

          <div style="
            color:${tokens.color.text.secondary};
            font-size:${tokens.font.size.xs};
            line-height:${tokens.font.lineHeight.relaxed};
            margin-bottom:${tokens.space[3]};
          ">
            ${compactProps(a)}
          </div>

          ${promptText ? `
            <div style="
              color:${tokens.color.text.primary};
              font-size:${tokens.font.size.sm};
              line-height:${tokens.font.lineHeight.relaxed};
              border-left:2px solid ${tokens.color.primary[600]};
              padding-left:${tokens.space[3]};
              margin-bottom:${tokens.space[2]};
            ">
              ${promptText}
            </div>
          ` : `
            <div style="
              color:${tokens.color.text.tertiary};
              font-size:${tokens.font.size.xs};
              font-style:italic;
              margin-bottom:${tokens.space[2]};
            ">
              No prompt — properties only
            </div>
          `}

          ${a.colorSuggestion ? `
            <div style="
              display:inline-flex;
              align-items:center;
              gap:${tokens.space[1]};
              background:${tokens.color.surface.elevated};
              border-radius:${tokens.radius.full};
              padding:2px 8px 2px 4px;
              font-size:${tokens.font.size.xs};
              color:${tokens.color.text.secondary};
              margin-bottom:${tokens.space[2]};
            ">
              <span style="
                width:12px;height:12px;
                background:${a.colorSuggestion};
                border-radius:${tokens.radius.full};
                border:1px solid rgba(255,255,255,0.15);
              "></span>
              <span style="font-family:${tokens.font.mono};">${a.colorSuggestion}</span>
            </div>
          ` : ""}

          <div style="text-align:right;">
            <button class="pt-edit-btn" data-id="${a.id}" style="
              background:${tokens.color.surface.elevated};
              border:1px solid ${tokens.color.surface.border};
              border-radius:${tokens.radius.md};
              color:${tokens.color.text.secondary};
              padding:${tokens.space[1]} ${tokens.space[3]};
              font:${tokens.font.weight.regular} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
              cursor:pointer;
              transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
            ">Edit</button>
          </div>
        </div>
      `;
			});
			cardsHtml += "</div>";
		}
		const footer = `
    <div style="
      padding:${tokens.space[4]} ${tokens.space[5]};
      border-top:1px solid ${tokens.color.surface.border};
      display:flex;
      gap:${tokens.space[3]};
      flex-shrink:0;
    ">
      <button id="pt-back-btn" style="
        flex:1;
        background:transparent;
        border:1px solid ${tokens.color.surface.border};
        border-radius:${tokens.radius.md};
        color:${tokens.color.text.secondary};
        padding:${tokens.space[3]};
        font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
        cursor:pointer;
        transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
      ">Back to Inspect</button>
      ${annotations.length > 0 ? `
        <button id="pt-copy-btn" style="
          flex:1;
          background:${tokens.color.primary[600]};
          border:none;
          border-radius:${tokens.radius.md};
          color:white;
          padding:${tokens.space[3]};
          font:${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
          cursor:pointer;
          transition:background ${tokens.transition.fast}, transform ${tokens.transition.fast};
          display:flex;
          align-items:center;
          justify-content:center;
          gap:${tokens.space[2]};
        ">
          ${isProxyMode() || isMcpMode() ? `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Submit to Agent
          ` : `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy to Clipboard
          `}
        </button>
      ` : ""}
    </div>
  `;
		panel.innerHTML = header + cardsHtml + footer;
		getUIRoot().appendChild(panel);
		const closeBtn = panel.querySelector("#pt-review-close");
		closeBtn.addEventListener("mouseenter", () => {
			closeBtn.style.background = tokens.color.surface.overlay;
			closeBtn.style.color = tokens.color.text.primary;
		});
		closeBtn.addEventListener("mouseleave", () => {
			closeBtn.style.background = tokens.color.surface.elevated;
			closeBtn.style.color = tokens.color.text.tertiary;
		});
		closeBtn.addEventListener("click", onBack);
		const backBtn = panel.querySelector("#pt-back-btn");
		backBtn.addEventListener("mouseenter", () => {
			backBtn.style.background = tokens.color.surface.elevated;
			backBtn.style.borderColor = tokens.color.text.tertiary;
		});
		backBtn.addEventListener("mouseleave", () => {
			backBtn.style.background = "transparent";
			backBtn.style.borderColor = tokens.color.surface.border;
		});
		backBtn.addEventListener("click", onBack);
		if (annotations.length > 0) {
			const copyBtn = panel.querySelector("#pt-copy-btn");
			copyBtn.addEventListener("mouseenter", () => {
				copyBtn.style.background = tokens.color.primary[700];
				copyBtn.style.transform = "translateY(-1px)";
			});
			copyBtn.addEventListener("mouseleave", () => {
				copyBtn.style.background = tokens.color.primary[600];
				copyBtn.style.transform = "translateY(0)";
			});
			copyBtn.addEventListener("mousedown", () => {
				copyBtn.style.transform = "scale(0.98)";
			});
			copyBtn.addEventListener("mouseup", () => {
				copyBtn.style.transform = "translateY(-1px)";
			});
			copyBtn.addEventListener("click", async () => {
				const agentMode = isProxyMode() || isMcpMode();
				copyBtn.disabled = true;
				copyBtn.style.opacity = "0.7";
				const originalHtml = copyBtn.innerHTML;
				const success = await onCopy();
				copyBtn.disabled = false;
				copyBtn.style.opacity = "1";
				if (success) {
					copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          ${agentMode ? "Sent!" : "Copied!"}
        `;
					copyBtn.style.background = tokens.color.success;
				} else {
					copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Failed
        `;
					copyBtn.style.background = tokens.color.error;
				}
				setTimeout(() => {
					if (copyBtn.isConnected) {
						copyBtn.innerHTML = originalHtml;
						copyBtn.style.background = tokens.color.primary[600];
					}
				}, 2e3);
			});
		}
		panel.querySelectorAll(".pt-review-card").forEach((card) => {
			const cardEl = card;
			cardEl.addEventListener("mouseenter", () => {
				cardEl.style.borderColor = tokens.color.primary[600] + "66";
				cardEl.style.boxShadow = `0 0 0 1px ${tokens.color.primary[600]}33`;
			});
			cardEl.addEventListener("mouseleave", () => {
				cardEl.style.borderColor = tokens.color.surface.border;
				cardEl.style.boxShadow = "none";
			});
			cardEl.addEventListener("click", (e) => {
				const target = e.target;
				if (target.closest(".pt-edit-btn") || target.closest(".pt-delete-btn")) return;
				const id = cardEl.dataset.id;
				const annotation = annotations.find((a) => a.id === id);
				if (annotation?.element?.isConnected) {
					annotation.element.scrollIntoView({
						behavior: "smooth",
						block: "center"
					});
					pulseHighlight(annotation.element);
				}
			});
		});
		panel.querySelectorAll(".pt-edit-btn").forEach((btn) => {
			const el = btn;
			el.addEventListener("mouseenter", () => {
				el.style.background = tokens.color.surface.overlay;
				el.style.borderColor = tokens.color.text.tertiary;
			});
			el.addEventListener("mouseleave", () => {
				el.style.background = tokens.color.surface.elevated;
				el.style.borderColor = tokens.color.surface.border;
			});
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				onEdit(el.dataset.id);
			});
		});
		panel.querySelectorAll(".pt-delete-btn").forEach((btn) => {
			const el = btn;
			el.addEventListener("mouseenter", () => {
				el.style.background = tokens.color.surface.elevated;
				el.style.color = tokens.color.error;
			});
			el.addEventListener("mouseleave", () => {
				el.style.background = "transparent";
				el.style.color = tokens.color.text.tertiary;
			});
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				onDelete(el.dataset.id);
			});
		});
	}
	function hideReviewPanel() {
		panel?.remove();
		panel = null;
	}
	function isReviewOpen() {
		return panel !== null;
	}
	//#endregion
	//#region src/index.ts
	var mode = "inactive";
	var annotations = [];
	var hoveredElement = null;
	var depthStack = [];
	var depthIndex = 0;
	function buildDepthStack(el) {
		const stack = [];
		let current = el;
		while (current && current !== document.body && current !== document.documentElement) {
			stack.unshift(current);
			current = current.parentElement;
		}
		return stack;
	}
	function getElementAtDepth(x, y, goDeeper) {
		if (!hoveredElement) return null;
		if (goDeeper) {
			const children = Array.from(hoveredElement.children);
			for (const child of children) {
				const rect = child.getBoundingClientRect();
				if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return child;
			}
			return hoveredElement;
		} else return hoveredElement.parentElement && hoveredElement.parentElement !== document.body ? hoveredElement.parentElement : hoveredElement;
	}
	function isOwnElement(el) {
		const host = getShadowHost();
		if (host && (el === host || host.contains(el))) return true;
		return !!(el.id?.startsWith("pt-") || el.className?.toString().includes("pt-") || el.closest("[id^=\"pt-\"]"));
	}
	function findAnnotation(el) {
		return annotations.find((a) => a.element === el) ?? null;
	}
	function isElementAnnotated(el) {
		return annotations.some((a) => a.element === el);
	}
	function hideToggleButton() {
		const btn = getUIRoot().querySelector("#pt-toggle-button");
		if (btn) btn.style.display = "none";
	}
	function showToggleButton() {
		const btn = getUIRoot().querySelector("#pt-toggle-button");
		if (btn) btn.style.display = "flex";
	}
	function activate() {
		if (mode !== "inactive") return;
		mode = "inspect";
		injectGlobalStyles();
		hideToggleButton();
		document.documentElement.classList.add("pt-inspect-cursor");
		updateStatusBar(annotations.length, openReview, deactivate);
		updateAllPins(annotations);
		document.addEventListener("mousemove", handleMouseMove, true);
		document.addEventListener("click", handleClick, true);
		document.addEventListener("wheel", handleWheel, {
			capture: true,
			passive: false
		});
		document.addEventListener("keydown", handleKeyDown, true);
	}
	function deactivate() {
		if (annotations.length > 0 && mode !== "review") {
			if (!confirm(`You have ${annotations.length} annotation${annotations.length !== 1 ? "s" : ""}. Exit and discard?`)) return;
		}
		mode = "inactive";
		annotations = [];
		hoveredElement = null;
		if (isMcpMode()) signalMcpClose();
		showToggleButton();
		document.documentElement.classList.remove("pt-inspect-cursor");
		document.removeEventListener("mousemove", handleMouseMove, true);
		document.removeEventListener("click", handleClick, true);
		document.removeEventListener("wheel", handleWheel, true);
		document.removeEventListener("keydown", handleKeyDown, true);
		hideHighlight();
		hideBreadcrumb();
		hidePopover();
		hideReviewPanel();
		clearAllPins();
		destroyHighlight();
		destroyBreadcrumb();
		destroyStatusBar();
	}
	function enterAnnotateMode(el) {
		mode = "annotate";
		hideHighlight();
		document.documentElement.classList.remove("pt-inspect-cursor");
		const styles = extractStyles(el);
		const source = extractSourceLocation(el);
		const classes = extractCssClasses(el);
		const text = extractTextContent(el);
		const existing = findAnnotation(el);
		showPopover(el, styles, existing, (prompt, colorSuggestion, changes) => {
			if (existing) {
				existing.prompt = prompt;
				existing.colorSuggestion = colorSuggestion;
				existing.changes = changes;
			} else {
				const annotation = {
					id: "ann-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
					element: el,
					selector: generateSelector(el),
					styles,
					source,
					cssClasses: classes,
					textContent: text,
					screenshotDataUrl: null,
					changes,
					prompt,
					colorSuggestion,
					timestamp: Date.now()
				};
				annotations.push(annotation);
				captureElementScreenshot(el).then((url) => {
					if (url) annotation.screenshotDataUrl = url;
				});
			}
			hidePopover();
			returnToInspect();
		}, () => {
			hidePopover();
			returnToInspect();
		}, source, classes, text);
	}
	function returnToInspect() {
		mode = "inspect";
		document.documentElement.classList.add("pt-inspect-cursor");
		updateAllPins(annotations);
		updateStatusBar(annotations.length, openReview, deactivate);
	}
	function clearAfterSubmit() {
		annotations = [];
		clearAllPins();
		hideReviewPanel();
		returnToInspect();
	}
	function openReview() {
		mode = "review";
		hideHighlight();
		hideBreadcrumb();
		hidePopover();
		document.documentElement.classList.remove("pt-inspect-cursor");
		showReviewPanel(annotations, (id) => {
			hideReviewPanel();
			const ann = annotations.find((a) => a.id === id);
			if (ann?.element?.isConnected) {
				ann.element.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
				setTimeout(() => enterAnnotateMode(ann.element), 300);
			} else returnToInspect();
		}, (id) => {
			annotations = annotations.filter((a) => a.id !== id);
			updateAllPins(annotations);
			openReview();
		}, async () => {
			const md = generateMarkdown(annotations);
			if (isProxyMode()) if (await submitToProxy(md)) {
				showToast(`Sent ${annotations.length} annotation${annotations.length !== 1 ? "s" : ""} to AI agent — you can close this tab`);
				clearAfterSubmit();
				return true;
			} else {
				const copied = await copyToClipboard(md);
				showToast(copied ? "Proxy unavailable — copied to clipboard instead" : "Submit failed — check console");
				console.log("--- Promptotype Output ---\n\n" + md);
				return copied;
			}
			else if (isMcpMode()) if (await submitToMcp(md)) {
				showToast(`Sent ${annotations.length} annotation${annotations.length !== 1 ? "s" : ""} to AI agent via MCP`);
				clearAfterSubmit();
				return true;
			} else {
				const copied = await copyToClipboard(md);
				showToast(copied ? "MCP server unavailable — copied to clipboard instead" : "Submit failed — check console");
				console.log("--- Promptotype Output ---\n\n" + md);
				return copied;
			}
			else {
				const success = await copyToClipboard(md);
				if (success) showToast(`Copied ${annotations.length} annotation${annotations.length !== 1 ? "s" : ""} — paste into your AI agent`);
				else {
					showToast("Copy failed — check console for output");
					console.log("--- Promptotype Output ---\n\n" + md);
				}
				return success;
			}
		}, () => {
			hideReviewPanel();
			returnToInspect();
		});
	}
	function showToast(message) {
		const toast = document.createElement("div");
		toast.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: ${tokens.color.surface.raised};
    color: ${tokens.color.text.primary};
    border: 1px solid ${tokens.color.surface.border};
    padding: ${tokens.space[3]} ${tokens.space[5]};
    border-radius: ${tokens.radius.lg};
    font: ${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    z-index: ${tokens.z.toast};
    box-shadow: ${tokens.shadow.lg};
    animation: pt-slide-up 0.2s ease-out;
    display: flex;
    align-items: center;
    gap: ${tokens.space[2]};
    overflow: hidden;
  `;
		toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${tokens.color.success}" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${message}</span>
  `;
		const progress = document.createElement("div");
		progress.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: ${tokens.color.primary[600]};
    animation: pt-toast-progress 3s linear forwards;
  `;
		toast.style.position = "fixed";
		toast.appendChild(progress);
		getUIRoot().appendChild(toast);
		setTimeout(() => {
			toast.style.opacity = "0";
			toast.style.transition = `opacity ${tokens.transition.slow}`;
			setTimeout(() => toast.remove(), 200);
		}, 3e3);
	}
	function handleMouseMove(e) {
		if (mode !== "inspect") return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (!el || isOwnElement(el)) {
			hideHighlight();
			hideBreadcrumb();
			hoveredElement = null;
			return;
		}
		if (el !== hoveredElement) {
			hoveredElement = el;
			depthStack = buildDepthStack(el);
			depthIndex = depthStack.length - 1;
		}
		const current = depthStack[depthIndex] || el;
		showHighlight(current, generateSelector(current), isElementAnnotated(current));
		updateBreadcrumb(current, (selected) => {
			hoveredElement = selected;
			depthStack = buildDepthStack(selected);
			depthIndex = depthStack.length - 1;
			showHighlight(selected, generateSelector(selected), isElementAnnotated(selected));
		});
	}
	function handleClick(e) {
		if (mode !== "inspect") return;
		const el = e.target;
		if (isOwnElement(el)) return;
		e.preventDefault();
		e.stopPropagation();
		const current = depthStack[depthIndex] || hoveredElement;
		if (current) enterAnnotateMode(current);
	}
	function handleWheel(e) {
		if (mode !== "inspect") return;
		if (!e.altKey) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.deltaY > 0) {
			const child = getElementAtDepth(e.clientX, e.clientY, true);
			if (child && child !== hoveredElement) {
				hoveredElement = child;
				depthStack = buildDepthStack(child);
				depthIndex = depthStack.length - 1;
			}
		} else if (depthIndex > 0) {
			depthIndex--;
			hoveredElement = depthStack[depthIndex];
		}
		if (hoveredElement) {
			const selector = generateSelector(hoveredElement);
			showHighlight(hoveredElement, selector, isElementAnnotated(hoveredElement));
			updateBreadcrumb(hoveredElement, (selected) => {
				hoveredElement = selected;
				depthStack = buildDepthStack(selected);
				depthIndex = depthStack.length - 1;
			});
		}
	}
	function handleKeyDown(e) {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			if (isPopoverOpen()) {
				hidePopover();
				returnToInspect();
			} else if (isReviewOpen()) {
				hideReviewPanel();
				returnToInspect();
			} else deactivate();
		}
	}
	onPinClick((id) => {
		if (mode === "inspect") {
			const ann = annotations.find((a) => a.id === id);
			if (ann?.element?.isConnected) enterAnnotateMode(ann.element);
		}
	});
	function toggle() {
		if (mode === "inactive") activate();
		else deactivate();
	}
	document.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
			e.preventDefault();
			toggle();
		}
	});
	function createToggleButton() {
		const btn = document.createElement("div");
		btn.id = "pt-toggle-button";
		btn.style.cssText = `
    position: fixed;
    bottom: ${tokens.space[4]};
    left: ${tokens.space[4]};
    width: 44px;
    height: 44px;
    background: ${tokens.color.primary[600]};
    color: white;
    border-radius: ${tokens.radius.lg};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483630;
    box-shadow: ${tokens.shadow.md};
    transition: background ${tokens.transition.fast}, transform ${tokens.transition.spring}, box-shadow ${tokens.transition.normal};
    user-select: none;
  `;
		btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
    <line x1="13" y1="8" x2="19" y2="8" stroke-linecap="round"/>
    <line x1="7" y1="13" x2="17" y2="13" stroke-linecap="round"/>
    <line x1="7" y1="17" x2="14" y2="17" stroke-linecap="round"/>
  </svg>`;
		btn.title = "Toggle Promptotype (Cmd+Shift+D)";
		btn.addEventListener("mouseenter", () => {
			btn.style.background = tokens.color.primary[700];
			btn.style.transform = "scale(1.08)";
			btn.style.boxShadow = `${tokens.shadow.lg}, ${tokens.shadow.glow}`;
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = tokens.color.primary[600];
			btn.style.transform = "scale(1)";
			btn.style.boxShadow = tokens.shadow.md;
		});
		btn.addEventListener("mousedown", () => {
			btn.style.transform = "scale(0.95)";
		});
		btn.addEventListener("mouseup", () => {
			btn.style.transform = "scale(1.08)";
		});
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			toggle();
		});
		getUIRoot().appendChild(btn);
	}
	function init() {
		if (getUIRoot().querySelector("#pt-toggle-button")) return;
		createToggleButton();
		console.log("%c Promptotype %c Ready — Cmd+Shift+D to activate", `background:${tokens.color.primary[600]};color:white;padding:2px 8px;border-radius:4px;font-weight:600`, `color:${tokens.color.primary[500]}`);
	}
	/**
	* Initialize Promptotype with an optional Shadow DOM root.
	* Called by the Chrome extension's content script.
	*/
	function initWithShadowDOM(shadowRoot, container, host) {
		initContext({
			uiRoot: container,
			styleRoot: shadowRoot,
			shadowHost: host
		});
		init();
	}
	if (!window.__PT_MCP__) if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	window.Promptotype = {
		activate,
		deactivate,
		toggle,
		initWithShadowDOM
	};
	//#endregion
})();
