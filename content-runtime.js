(() => {
  const editableSelector = [
    ".eyebrow", ".hero-name", ".name-en", ".hero-intro",
    ".portrait-meta span", ".portrait-card > p", ".portrait-card > strong",
    ".focus-item p", ".focus-item strong", ".section-number", ".section h2",
    ".section-side-note", ".about-copy > p", ".about-facts span",
    ".item-period", ".item-kicker", ".education-item h3", ".education-item div > p:last-child",
    ".project-card-top span", ".project-tags span", ".project-body h3", ".project-body > p",
    ".project-detail", ".capability-group > span", ".capability-group h3", ".capability-group li",
    ".metric-pair strong", ".metric-pair span", ".publication-index span", ".publication-index em",
    ".publication-copy h3", ".publication-copy p", ".publication-item > a",
    ".patent-summary > span", ".subsection-heading h3", ".subsection-heading > span",
    ".patent-status", ".patent-title h3", ".patent-title p", ".patent-inventors",
    ".patent-meta dt", ".patent-meta dd", ".copyright-index", ".copyright-item h4",
    ".copyright-item > p", ".copyright-item dt", ".copyright-item dd",
    ".honor-card > span", ".honor-card h3", ".honor-card p",
    ".activity-column-head span", ".activity-column-head strong", ".activity-column h3",
    ".activity-item h4", ".activity-meta span", ".activity-meta time",
    ".activity-location", ".activity-detail", ".contact-section h2", ".contact-details > p",
    ".contact-details > a", ".contact-meta span", "footer span", "footer a"
  ].join(",");

  const pathFor = (element) => {
    const segments = [];
    let current = element;
    while (current && current !== document.body) {
      if (current.id) {
        segments.unshift(`#${current.id}`);
        break;
      }
      const tag = current.tagName.toLowerCase();
      const siblings = [...current.parentElement.children].filter((item) => item.tagName === current.tagName);
      const position = siblings.indexOf(current) + 1;
      segments.unshift(`${tag}:nth-of-type(${position})`);
      current = current.parentElement;
    }
    return segments.join(" > ");
  };

  const collect = (scope = document) => [...scope.querySelectorAll(editableSelector)].map((element) => ({
    element,
    key: pathFor(element)
  }));

  const sanitize = (value) => {
    const template = document.createElement("template");
    template.innerHTML = String(value ?? "");
    const allowedTags = new Set(["STRONG", "EM", "BR", "SPAN"]);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => {
        if (attribute.name !== "class") node.removeAttribute(attribute.name);
      });
      if (node.hasAttribute("class")) {
        const safeClasses = node.className.split(/\s+/).filter((name) => ["author-highlight"].includes(name));
        if (safeClasses.length) node.className = safeClasses.join(" ");
        else node.removeAttribute("class");
      }
    });
    return template.innerHTML;
  };

  const apply = (content = {}) => {
    collect().forEach(({ element, key }) => {
      const entry = content[key];
      if (!entry || typeof entry.html !== "string") return;
      element.innerHTML = sanitize(entry.html);
      if (element instanceof HTMLAnchorElement && typeof entry.href === "string") {
        const href = entry.href.trim();
        if (/^(https?:|mailto:|tel:|#)/i.test(href)) element.setAttribute("href", href);
      }
    });
  };

  const ready = fetch("/api/content", { cache: "no-store", headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (payload?.content) apply(payload.content);
      window.dispatchEvent(new CustomEvent("resume-content-ready", { detail: payload }));
      return payload;
    })
    .catch(() => null);

  window.ResumeCMS = { collect, sanitize, apply, ready };
})();
