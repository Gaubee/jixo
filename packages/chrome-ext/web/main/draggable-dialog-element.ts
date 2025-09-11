import {JIXORootFactory} from "./root-helper";

export class JIXODraggableDialogElement extends HTMLElement {
  // 静态属性，保持与 Web Component 版本的接口一致性
  static readonly is = "jixo-draggable-dialog" as const;
  static readonly tagName = JIXODraggableDialogElement.is.toUpperCase() as Uppercase<typeof JIXODraggableDialogElement.is>;
  static readonly selector = `jixo-draggable-dialog`; // 现在使用类选择器

  private _dialogElement: HTMLDialogElement; // 主对话框的 Dialog 元素
  private _isDragging: boolean = false;
  private _dragOffsetX: number = 0;
  private _dragOffsetY: number = 0;
  private _resizeObserver: ResizeObserver | null = null;

  // 吸附边缘的配置
  private readonly SNAP_PADDING: number = 10; // 距离窗口边缘的像素

  constructor() {
    super();
    const root = this.attachShadow({mode: "open"});
    this._dialogElement = document.createElement("dialog");
    this._dialogElement.setAttribute("is", JIXODraggableDialogElement.is);
    this._dialogElement.popover = "manual";
    JIXORootFactory({
      cssRoot: root,
      eleSource: this,
      eleTarget: this._dialogElement,
      moveTo: (_f, c, _t) => {
        const slot = c instanceof Element ? c.getAttribute("slot") : null;
        if (slot === "header") {
          this._dialogElement.querySelector(`slot[name="header"]`)!.appendChild(c);
        }
        if (slot === "footer") {
          this._dialogElement.querySelector(`slot[name="footer"]`)!.appendChild(c);
        }
        if (slot === "content" || slot == null) {
          this._dialogElement.querySelector(`slot[name="content"]`)!.appendChild(c);
        }
      },
      attrEle: this,
    });
    root.appendChild(this._dialogElement);
    const innerCssSheet = new CSSStyleSheet();
    root.adoptedStyleSheets.push(innerCssSheet);
    const css = String.raw;
    const html = String.raw;
    innerCssSheet.replaceSync(css`
      @media (prefers-color-scheme: dark) {
        dialog[is="jixo-draggable-dialog"] {
          backdrop-filter: blur(10px) contrast(0.8);
          background: rgba(0, 0, 0, 0.2); /* 半透明黑色背景 */
        }
      }
      dialog[is="jixo-draggable-dialog"] {
        top: ${this.SNAP_PADDING}px; /* 初始位置 */
        left: ${this.SNAP_PADDING}px; /* 初始位置 */
        min-width: 150px;
        min-height: 100px;
        box-sizing: border-box;
        padding: 0;
        border: none;
        margin: 0;

        /* 液态玻璃效果 */
        border-radius: 20px;
        corner-shape: superellipse(2);
        overflow: hidden; /* 确保模糊效果不会溢出 */
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        backdrop-filter: blur(10px) saturate(2);
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.2); /* 半透明白色背景 */
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0, 0.95, 0.5, 0.9);
        transition-property: all;
        transition-behavior: allow-discrete;

        display: flex;
        flex-direction: column;

        &::backdrop {
          display: none;
        }
        &:not([open]) {
          scale: 0.6;
          opacity: 0;
          transition-duration: 0.5s;
          pointer-events: none;
          visibility: hidden;
        }
        &[open] {
          scale: 1;
          opacity: 1;
          @starting-style {
            scale: 0.6;
            opacity: 0;
          }

          /* 内部布局为 flex column */
          display: flex;
          flex-direction: column;
        }
        [data-draggable="true"] {
          cursor: grab;
        }
        &[data-dragging="true"] {
          transition-property: none;
          [data-draggable="true"] {
            cursor: grabbing;
          }
        }
        [part="dialog-header"] {
          flex-shrink: 0;
          user-select: none; /* 防止拖拽时文本被选中 */
        }
        [part="dialog-content"] {
          flex-grow: 1;
          overflow-y: auto; /* 内容溢出时允许滚动 */
        }
      }
    `);
    // 内部结构 (不再使用 Shadow DOM 和 slot，直接创建 div), 使用 data-part 属性模拟 CSS Parts
    const template = document.createElement("template");
    // @ts-ignore
    const escapeHTMLPolicy = (trustedTypes as TrustedTypePolicyFactory).createPolicy("forceInner", {
      createHTML: (to_escape) => to_escape,
    });
    // @ts-ignore
    template.innerHTML = escapeHTMLPolicy.createHTML(html`
      <div part="dialog-header"><slot name="header"></slot></div>
      <div part="dialog-content"><slot name="content"></slot></div>
      <div part="dialog-footer"><slot name="footer"></slot></div>
    `);
    this._dialogElement.appendChild(template.content);

    this._setupEventListeners();
    this._snapToEdge(); // 初始吸附
  }
  /**
   * 静态方法，用于创建 JIXODraggableDialog 的实例。
   * 保持与 Web Component 版本的 `createElement` 接口一致。
   */
  static createElement(sessionId: string): JIXODraggableDialogElement {
    // return new JIXODraggableDialogElement();
    const ele = document.createElement(JIXODraggableDialogElement.is) as JIXODraggableDialogElement;
    ele.dataset.sessionId = sessionId;
    return ele;
  }

  /**
   * 获取对话框的根 DOM 元素。
   * 外部代码需要将此元素添加到文档中。
   */
  public get element(): HTMLDialogElement {
    return this._dialogElement;
  }

  /**
   * 设置对话框的头部内容。
   * @param element 要作为头部内容的 HTMLElement。
   */
  public setHeader(element: HTMLElement | DocumentFragment) {
    const headerSlot = this._dialogElement.querySelector('[data-part="dialog-header"]');
    if (headerSlot) {
      headerSlot.innerHTML = ""; // 清除旧内容
      headerSlot.appendChild(element);
    }
  }

  /**
   * 设置对话框的主要内容。
   * @param element 要作为主要内容的 HTMLElement。
   */
  public setContent(element: HTMLElement | DocumentFragment) {
    const contentSlot = this._dialogElement.querySelector('[data-part="dialog-content"]');
    if (contentSlot) {
      contentSlot.innerHTML = ""; // 清除旧内容
      contentSlot.appendChild(element);
    }
  }

  private _setupEventListeners() {
    this._dialogElement.addEventListener("pointerdown", this._handleMouseDown);
    window.addEventListener("pointerup", this._handleMouseUp);
    window.addEventListener("pointermove", this._handleMouseMove);
    window.addEventListener("resize", this._handleResize);

    // 监听对话框自身大小的变化
    this._resizeObserver = new ResizeObserver(() => this._snapToEdge());
    this._resizeObserver.observe(this._dialogElement);

    // 监听属性变化

    /// 监听属性变化
    new MutationObserver(() => {
      if (this.dataset.open === "true") {
        this.openDialog();
      } else {
        this.closeDialog();
      }
    }).observe(this, {attributes: true, attributeFilter: ["data-open"]});
  }

  /**
   * 清理事件监听器和 DOM 元素。
   * 当对话框不再需要时，应调用此方法。
   */
  public destroy() {
    this._dialogElement.removeEventListener("pointerdown", this._handleMouseDown);
    window.removeEventListener("pointerup", this._handleMouseUp);
    window.removeEventListener("pointermove", this._handleMouseMove);
    window.removeEventListener("resize", this._handleResize);
    this._resizeObserver?.disconnect();
    this._dialogElement.remove(); // 从 DOM 中移除元素
  }

  /**
   * 打开对话框。
   * 这将使其可见并进行吸附。
   */
  public openDialog() {
    if (this.open) return;
    // this._dialogElement.showPopover();
    this._dialogElement.open = true;

    const raf = () => new Promise((cb) => requestAnimationFrame(cb));
    (async () => {
      await raf();
      let key = this._snapToEdge(); // 打开时进行吸附
      while (!this._isDragging) {
        await raf();
        const newKey = this._snapToEdge();
        if (newKey === key) {
          break;
        }
        key = newKey;
      }
    })();
  }
  /**
   * 关闭对话框。
   * 这将使其隐藏。
   */
  public closeDialog() {
    if (!this.open) return;
    this._dialogElement.close();
    this._dialogElement.hidePopover();
  }

  get open() {
    return this._dialogElement.open;
  }
  public toggleDialog() {
    if (this.open) {
      this.closeDialog();
    } else {
      this.openDialog();
    }
  }

  private _handleMouseDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    // 只有当对话框可见且目标元素有 data-draggable="true" 时才允许拖拽
    if (this.open && target.dataset.draggable === "true") {
      this._isDragging = true;
      this._dialogElement.dataset.dragging = "true";
      // 存储鼠标相对于对话框左上角的偏移量
      const rect = this._dialogElement.getBoundingClientRect();
      this._dragOffsetX = e.clientX - rect.left;
      this._dragOffsetY = e.clientY - rect.top;

      // 阻止拖拽时文本被选中
      e.preventDefault();
    }
  };

  private _handleMouseMove = (e: PointerEvent) => {
    if (!this._isDragging) return;

    // 计算新位置
    let newLeft = e.clientX - this._dragOffsetX;
    let newTop = e.clientY - this._dragOffsetY;

    // 应用新位置
    this._dialogElement.style.left = `${newLeft}px`;
    this._dialogElement.style.top = `${newTop}px`;
    this._dialogElement.style.right = "auto"; // 清除 right/bottom，确保 left/top 优先
    this._dialogElement.style.bottom = "auto";
  };

  private _handleMouseUp = () => {
    if (this._isDragging) {
      this._isDragging = false;
      this._dialogElement.dataset.dragging = undefined;
      this._snapToEdge(); // 拖拽结束后吸附到边缘
    }
  };

  private _handleResize = () => {
    if (this.open) {
      // 只有当对话框可见时才进行吸附
      this._snapToEdge();
    }
  };

  private _snapToEdge() {
    const rect = this._dialogElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let newLeft = rect.left;
    let newTop = rect.top;

    // 水平吸附
    if (rect.left < windowWidth / 2 - rect.width / 2) {
      // 靠近左边缘
      newLeft = this.SNAP_PADDING;
    } else {
      // 靠近右边缘
      newLeft = windowWidth - rect.width - this.SNAP_PADDING;
    }

    // 垂直吸附
    if (rect.top < windowHeight / 2 - rect.height / 2) {
      // 靠近上边缘
      newTop = this.SNAP_PADDING;
    } else {
      // 靠近下边缘
      newTop = windowHeight - rect.height - this.SNAP_PADDING;
    }

    // 确保吸附后不会溢出窗口
    newLeft = Math.max(this.SNAP_PADDING, Math.min(newLeft, windowWidth - rect.width - this.SNAP_PADDING));
    newTop = Math.max(this.SNAP_PADDING, Math.min(newTop, windowHeight - rect.height - this.SNAP_PADDING));

    this._dialogElement.style.left = `${newLeft}px`;
    this._dialogElement.style.top = `${newTop}px`;
    this._dialogElement.style.right = "auto";
    this._dialogElement.style.bottom = "auto";
    return JSON.stringify(rect.toJSON());
  }

  appendTo(parent: HTMLElement) {
    parent.appendChild(this._dialogElement);
  }
}
