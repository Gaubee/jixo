import tailwindCssContent from "./styles.css?inline";
export const JIXORootElementHelper = {
  getAdoptedStyleSheets() {
    return [] as CSSStyleSheet[];
  },
  pushSdoptedStyleSheets(...values: CSSStyleSheet[]) {
    return;
  },
};
export const JIXORootFactory = (config: {
  /// 提供adoptedStyleSheets
  cssRoot: DocumentOrShadowRoot;
  // 提供元素容器
  eleSource: HTMLElement;
  // 提供容器迁移的目标
  eleTarget: HTMLElement | DocumentFragment;
  moveTo?: (fromEle: HTMLElement, childEle: ChildNode, toEle: HTMLElement | DocumentFragment) => void;
  // 提供属性容器
  attrEle: HTMLElement;
}) => {
  const openCssSheet = new CSSStyleSheet();
  const tailwindCssSheet = new CSSStyleSheet();
  tailwindCssSheet.replaceSync(tailwindCssContent);
  config.cssRoot.adoptedStyleSheets = [tailwindCssSheet, openCssSheet];
  JIXORootElementHelper.getAdoptedStyleSheets = () => config.cssRoot.adoptedStyleSheets;
  JIXORootElementHelper.pushSdoptedStyleSheets = (...values) => config.cssRoot.adoptedStyleSheets.push(...values);

  const moveChildrenToShadow = () => {
    const moveTo =
      config.moveTo ??
      (((_f, c, t) => {
        t.appendChild(c);
      }) satisfies (typeof config)["moveTo"]);
    // 用 Array.from 防止 live 集合导致的索引错位
    Array.from(config.eleSource.childNodes).forEach((node) => {
      moveTo(config.eleSource, node, config.eleTarget);
    });
  };
  const syncFromDataset = () => {
    const cssText = config.attrEle.dataset.css;
    openCssSheet.replaceSync(cssText || "");
  };
  // 只监听“子节点”变化即可
  new MutationObserver(() => {
    // 再次把可能新增的节点搬进去
    moveChildrenToShadow();
  }).observe(config.eleSource, {childList: true});
  /// 监听属性变化
  new MutationObserver(() => {
    syncFromDataset();
  }).observe(config.attrEle, {attributes: true, attributeFilter: ["data-css"]});
};