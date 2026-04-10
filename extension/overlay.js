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
	function rgbToHex(color) {
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) return "#" + [
			parseInt(match[1]),
			parseInt(match[2]),
			parseInt(match[3])
		].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
		try {
			const ctx = document.createElement("canvas").getContext("2d");
			if (ctx) {
				ctx.fillStyle = color;
				const result = ctx.fillStyle;
				if (result.startsWith("#")) return result.toUpperCase();
				const rgbMatch = result.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
				if (rgbMatch) return "#" + [
					rgbMatch[1],
					rgbMatch[2],
					rgbMatch[3]
				].map((v) => parseInt(v).toString(16).padStart(2, "0")).join("").toUpperCase();
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
    top: 0;
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
    border-bottom: 1px solid ${tokens.color.surface.borderSubtle};
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
	//#region src/annotation-popover.ts
	var POPOVER_ID = "pt-annotation-popover";
	var popover = null;
	function colorChip(hex, label) {
		return `
    <div class="pt-color-chip" data-hex="${hex}" style="
      display:inline-flex;
      align-items:center;
      gap:${tokens.space[1]};
      background:${tokens.color.surface.elevated};
      border:1px solid ${tokens.color.surface.border};
      border-radius:${tokens.radius.full};
      padding:2px 8px 2px 4px;
      cursor:pointer;
      transition:border-color ${tokens.transition.fast};
      font-size:${tokens.font.size.xs};
    ">
      <span style="
        width:14px;
        height:14px;
        background:${hex};
        border-radius:${tokens.radius.full};
        border:1px solid rgba(255,255,255,0.1);
        flex-shrink:0;
      "></span>
      <span style="color:${tokens.color.text.secondary};font-family:${tokens.font.mono};font-size:${tokens.font.size.xs};">${label}: ${hex}</span>
    </div>
  `;
	}
	function propertySection(title, content) {
		return `
    <div style="margin-bottom:${tokens.space[3]};">
      <div style="
        color:${tokens.color.text.tertiary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        text-transform:uppercase;
        letter-spacing:0.8px;
        margin-bottom:${tokens.space[1]};
      ">${title}</div>
      <div style="color:${tokens.color.text.primary};font-size:${tokens.font.size.sm};line-height:${tokens.font.lineHeight.relaxed};">
        ${content}
      </div>
    </div>
  `;
	}
	function formatSpacing(val) {
		return val.replace(/px/g, "").split(" ").map((v) => {
			const num = parseFloat(v);
			return `<span style="
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:28px;
      height:20px;
      background:${num === 0 ? tokens.color.surface.elevated : tokens.color.surface.overlay};
      border-radius:${tokens.radius.sm};
      font-family:${tokens.font.mono};
      font-size:${tokens.font.size.xs};
      color:${num === 0 ? tokens.color.text.tertiary : tokens.color.text.primary};
      padding:0 4px;
    ">${v}</span>`;
		}).join(" ");
	}
	function showPopover(el, styles, existing, onSave, onCancel) {
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
    width: 340px;
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
		const fontInfo = `
    <span style="font-weight:${tokens.font.weight.medium};color:${tokens.color.text.primary};">${styles.font.family}</span>
    <span style="color:${tokens.color.text.tertiary};">·</span>
    ${styles.font.size}
    <span style="color:${tokens.color.text.tertiary};">·</span>
    <span style="font-weight:${styles.font.weight};">${styles.font.weight}</span>
    <span style="color:${tokens.color.text.tertiary};">·</span>
    <span style="color:${tokens.color.text.secondary};">/${styles.font.lineHeight}</span>
  `;
		const colorInfo = `
    <div style="display:flex;flex-wrap:wrap;gap:${tokens.space[2]};">
      ${colorChip(styles.color.text, "Text")}
      ${colorChip(styles.color.background, "Bg")}
    </div>
  `;
		const spacingInfo = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;">
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">Margin</span>
      <div style="display:flex;gap:2px;">${formatSpacing(styles.spacing.margin)}</div>
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">Padding</span>
      <div style="display:flex;gap:2px;">${formatSpacing(styles.spacing.padding)}</div>
    </div>
  `;
		const alignInfo = `
    <div style="display:flex;flex-wrap:wrap;gap:${tokens.space[1]};">
      ${[
			styles.alignment.textAlign,
			styles.alignment.display,
			`align: ${styles.alignment.alignItems}`
		].filter((v) => v && !v.includes("normal")).map((v) => `<span style="
          background:${tokens.color.surface.elevated};
          border-radius:${tokens.radius.sm};
          padding:2px 6px;
          font-size:${tokens.font.size.xs};
          font-family:${tokens.font.mono};
          color:${tokens.color.text.secondary};
        ">${v}</span>`).join("")}
    </div>
  `;
		popover.innerHTML = `
    <div style="
      padding:${tokens.space[3]} ${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:center;
    ">
      <span style="
        font-weight:${tokens.font.weight.semibold};
        color:${tokens.color.primary[400]};
        font-size:${tokens.font.size.sm};
        font-family:${tokens.font.mono};
      ">${selector}</span>
      <button id="pt-popover-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:24px;
        height:24px;
        border-radius:${tokens.radius.sm};
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>

    <div style="
      padding:${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      max-height:220px;
      overflow-y:auto;
    ">
      ${propertySection("Typography", fontInfo)}
      ${propertySection("Color", colorInfo)}
      ${propertySection("Spacing", spacingInfo)}
      ${propertySection("Layout", alignInfo)}
    </div>

    <div style="padding:${tokens.space[4]};">
      <label for="pt-prompt" style="
        display:block;
        color:${tokens.color.text.secondary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        text-transform:uppercase;
        letter-spacing:0.8px;
        margin-bottom:${tokens.space[2]};
      ">Your prompt</label>
      <textarea
        id="pt-prompt"
        rows="3"
        placeholder="What should change?"
        style="
          width:100%;
          box-sizing:border-box;
          background:${tokens.color.surface.base};
          border:1px solid ${tokens.color.surface.border};
          border-radius:${tokens.radius.md};
          color:${tokens.color.text.primary};
          font:${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
          padding:${tokens.space[3]};
          resize:vertical;
          outline:none;
          transition:border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast};
        "
      >${existing?.prompt ?? ""}</textarea>

      <div style="margin-top:${tokens.space[3]};display:flex;align-items:center;gap:${tokens.space[2]};">
        <label for="pt-color" style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};white-space:nowrap;">Suggest color:</label>
        <div style="
          position:relative;
          flex:1;
          display:flex;
          align-items:center;
        ">
          <span id="pt-color-preview" style="
            position:absolute;
            left:8px;
            width:16px;
            height:16px;
            border-radius:${tokens.radius.sm};
            border:1px solid ${tokens.color.surface.border};
            background:transparent;
          "></span>
          <input
            id="pt-color"
            type="text"
            placeholder="#000000"
            value="${existing?.colorSuggestion ?? ""}"
            maxlength="7"
            style="
              width:100%;
              background:${tokens.color.surface.base};
              border:1px solid ${tokens.color.surface.border};
              border-radius:${tokens.radius.md};
              color:${tokens.color.text.primary};
              font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
              padding:${tokens.space[2]} ${tokens.space[2]} ${tokens.space[2]} 32px;
              outline:none;
              transition:border-color ${tokens.transition.fast};
            "
          >
        </div>
      </div>

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
          ">${existing ? "Update" : "Save Annotation"}</button>
        </div>
      </div>
    </div>
  `;
		getUIRoot().appendChild(popover);
		const textarea = popover.querySelector("#pt-prompt");
		const colorInput = popover.querySelector("#pt-color");
		const colorPreview = popover.querySelector("#pt-color-preview");
		const closeBtn = popover.querySelector("#pt-popover-close");
		const cancelBtn = popover.querySelector("#pt-popover-cancel");
		const saveBtn = popover.querySelector("#pt-popover-save");
		setTimeout(() => textarea.focus(), 50);
		textarea.addEventListener("focus", () => {
			textarea.style.borderColor = tokens.color.primary[600];
			textarea.style.boxShadow = `0 0 0 2px ${tokens.color.primary[600]}33`;
		});
		textarea.addEventListener("blur", () => {
			textarea.style.borderColor = tokens.color.surface.border;
			textarea.style.boxShadow = "none";
		});
		const updateColorPreview = () => {
			const val = colorInput.value.trim();
			if (/^#[A-Fa-f0-9]{6}$/.test(val)) colorPreview.style.background = val;
			else colorPreview.style.background = "transparent";
		};
		colorInput.addEventListener("input", updateColorPreview);
		updateColorPreview();
		closeBtn.addEventListener("mouseenter", () => {
			closeBtn.style.background = tokens.color.surface.overlay;
			closeBtn.style.color = tokens.color.text.primary;
		});
		closeBtn.addEventListener("mouseleave", () => {
			closeBtn.style.background = tokens.color.surface.elevated;
			closeBtn.style.color = tokens.color.text.tertiary;
		});
		closeBtn.addEventListener("click", onCancel);
		cancelBtn.addEventListener("mouseenter", () => {
			cancelBtn.style.background = tokens.color.surface.elevated;
			cancelBtn.style.borderColor = tokens.color.text.tertiary;
		});
		cancelBtn.addEventListener("mouseleave", () => {
			cancelBtn.style.background = "transparent";
			cancelBtn.style.borderColor = tokens.color.surface.border;
		});
		cancelBtn.addEventListener("click", onCancel);
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
			onSave(textarea.value.trim(), colorInput.value.trim());
		});
		textarea.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				saveBtn.click();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		});
		popover.querySelectorAll(".pt-color-chip").forEach((chip) => {
			chip.addEventListener("mouseenter", () => {
				chip.style.borderColor = tokens.color.primary[500];
			});
			chip.addEventListener("mouseleave", () => {
				chip.style.borderColor = tokens.color.surface.border;
			});
			chip.addEventListener("click", () => {
				const hex = chip.dataset.hex;
				if (hex) {
					colorInput.value = hex;
					updateColorPreview();
				}
			});
		});
	}
	function hidePopover() {
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
			md += `**Current styles:**\n`;
			md += `- Font: ${s.font.family}, ${s.font.size}, weight ${s.font.weight}, line-height ${s.font.lineHeight}\n`;
			md += `- Color: ${s.color.text} (on background ${s.color.background})\n`;
			md += `- Margin: ${s.spacing.margin}\n`;
			md += `- Padding: ${s.spacing.padding}\n`;
			md += `- Alignment: ${s.alignment.textAlign}, ${s.alignment.display}, align-items: ${s.alignment.alignItems}\n`;
			md += `\n`;
			if (a.prompt) md += `**Prompt:** ${a.prompt}\n`;
			if (a.colorSuggestion) md += `\n**Suggested color:** ${a.colorSuggestion}\n`;
			if (!a.prompt && !a.colorSuggestion) md += `**Prompt:** Review this element\n`;
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
	function compactProps(a) {
		const s = a.styles;
		const parts = [];
		parts.push(`<span style="font-family:${tokens.font.mono};font-size:${tokens.font.size.xs};">${s.font.family} ${s.font.size} · ${s.font.weight}</span>`);
		const colorDot = (hex) => `<span style="
    display:inline-block;
    width:10px;height:10px;
    background:${hex};
    border-radius:${tokens.radius.full};
    border:1px solid rgba(255,255,255,0.15);
    vertical-align:middle;
  "></span>`;
		parts.push(`${colorDot(s.color.text)} ${s.color.text} ${colorDot(s.color.background)} ${s.color.background}`);
		return parts.join("<span style=\"color:" + tokens.color.text.tertiary + ";margin:0 6px;\">·</span>");
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
	function activate() {
		if (mode !== "inactive") return;
		mode = "inspect";
		injectGlobalStyles();
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
		const existing = findAnnotation(el);
		showPopover(el, styles, existing, (prompt, colorSuggestion) => {
			if (existing) {
				existing.prompt = prompt;
				existing.colorSuggestion = colorSuggestion;
			} else annotations.push({
				id: "ann-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
				element: el,
				selector: generateSelector(el),
				styles,
				prompt,
				colorSuggestion,
				timestamp: Date.now()
			});
			hidePopover();
			returnToInspect();
		}, () => {
			hidePopover();
			returnToInspect();
		});
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
