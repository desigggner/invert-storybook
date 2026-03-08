    (function () {
      var AUTH_PASSWORD = "invertapp2026";
      var AUTH_TTL_MS = 24 * 60 * 60 * 1000;
      var AUTH_EXP_KEY = "storybook-auth-exp";

      function getAuthExp() {
        try {
          var value = localStorage.getItem(AUTH_EXP_KEY);
          var exp = value ? parseInt(value, 10) : 0;
          return Number.isFinite(exp) ? exp : 0;
        } catch (e) {
          return 0;
        }
      }

      function setAuthExp(exp) {
        try {
          localStorage.setItem(AUTH_EXP_KEY, String(exp));
        } catch (e) {}
      }

      function clearAuthExp() {
        try {
          localStorage.removeItem(AUTH_EXP_KEY);
        } catch (e) {}
      }

      function isAuthorized() {
        var exp = getAuthExp();
        return exp > Date.now();
      }

      function lockStorybook() {
        document.body.classList.add("auth-locked");
      }

      function unlockStorybook() {
        document.body.classList.remove("auth-locked");
      }

      document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("auth-gate-form");
        var input = document.getElementById("auth-gate-input");
        var error = document.getElementById("auth-gate-error");
        var submit = document.getElementById("auth-gate-submit");

        function showError(show, message) {
          if (!error) return;
          if (typeof message === "string") {
            error.textContent = message;
          }
          error.classList.toggle("auth-gate-error--visible", !!show);
          if (input) {
            input.classList.toggle("auth-gate-input--invalid", !!show);
          }
        }

        function syncSubmitState() {
          if (!submit || !input) return;
          submit.disabled = !input.value.trim();
        }

        if (isAuthorized()) {
          unlockStorybook();
        } else {
          clearAuthExp();
          lockStorybook();
          if (input) {
            setTimeout(function () { input.focus(); }, 0);
          }
        }

        if (!form || !input) return;
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          var value = (input.value || "").trim();
          if (!value) {
            showError(true, "Введите пароль");
            syncSubmitState();
            input.focus();
            return;
          }
          if (value === AUTH_PASSWORD) {
            setAuthExp(Date.now() + AUTH_TTL_MS);
            showError(false, "");
            input.value = "";
            syncSubmitState();
            unlockStorybook();
            return;
          }
          showError(true, "Неверный пароль");
          input.select();
        });

        input.addEventListener("input", function () {
          showError(false, "");
          syncSubmitState();
        });
        syncSubmitState();
      });
    })();

    (function () {
      var THEME_KEY = "storybook-theme";
      function getTheme() {
        try {
          var s = localStorage.getItem(THEME_KEY);
          return s === "dark" ? "dark" : "light";
        } catch (e) { return "light"; }
      }
      function setTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
        document.dispatchEvent(new CustomEvent("storybook-theme-change", { detail: { theme: theme } }));
        var label = document.getElementById("theme-label");
        if (label) label.textContent = "Темная тема";
        var logo = document.getElementById("header-logo");
        if (logo) logo.src = theme === "dark" ? "logo-dark.svg" : "logo-light.svg";
        var gateLogo = document.getElementById("auth-gate-logo");
        if (gateLogo) gateLogo.src = "frame-28.svg";
      }
      document.addEventListener("DOMContentLoaded", function () {
        setTheme(getTheme());
        var btn = document.getElementById("theme-toggle");
        if (btn) {
          btn.dataset.themeBound = "1";
          btn.addEventListener("click", function () {
            var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            setTheme(next);
          });
        }
      });
    })();
    document.addEventListener("DOMContentLoaded", function () {
      var hubTabs = document.getElementById("hub-tabs");
      var hubGrid = document.getElementById("hub-grid");
      var hubOverview = document.getElementById("hub-overview");
      var hubSearchInput = document.getElementById("hub-search");
      var detailScroll = document.getElementById("detail-scroll");
      var detailHeader = document.getElementById("detail-header");
      var detailTitle = document.getElementById("detail-title");
      var detailBackBtn = document.getElementById("detail-back-btn");
      var iconsGrid = document.getElementById("icons-grid");
      var iconsLoadSentinel = document.getElementById("icons-load-sentinel");
      var activeHubTab = "intro";
      var hubItems = [];
      var allIcons = Array.isArray(window.INVERT_ICONS) ? window.INVERT_ICONS.slice() : [];
      var renderedIcons = [];
      var renderedIconsCount = 0;
      var iconsPageSize = 30;
      var iconsLoadObserver = null;
      var hubSearchDebounceTimer = null;
      var sectionCategories = {
        "section-intro": "intro",
        "section-accessibility": "accessibility",
        "section-icons": "icons",
        "section-palette": "colors",
        "section-base-colors": "colors",
        "section-semantic-colors": "colors",
        "section-radius-spacing": "radius",
        "section-typography-page": "tokens",
        "section-typography-presets": "tokens",
        "section-typography-android": "tokens",
        "section-typography-ios": "tokens"
      };

      function getCategoryById(id) {
        if (!id) return "components";
        if (sectionCategories[id]) return sectionCategories[id];
        return "components";
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function getIconName(filename) {
        return filename.replace(/\.svg$/i, "");
      }

      function getIconCardMarkup(filename) {
        var defaultSize = "32";
        var iconName = getIconName(filename);
        var safeName = escapeHtml(iconName);
        var safeFile = escapeHtml(filename);
        var safePath = "icons/" + safeFile;
        return (
          '<article class="icon-item">' +
            '<p class="icon-name">' + safeName + '</p>' +
            '<div class="icon-preview">' +
              '<img class="icon-preview-img" src="' + safePath + '" alt="' + safeName + '" loading="lazy" style="width:' + defaultSize + 'px;height:' + defaultSize + 'px;">' +
            '</div>' +
            '<div class="icon-controls">' +
              '<select class="icon-size-select" aria-label="Размер иконки">' +
                '<option value="32" selected>32 px</option>' +
                '<option value="24">24 px</option>' +
                '<option value="20">20 px</option>' +
                '<option value="16">16 px</option>' +
              '</select>' +
              '<button type="button" class="icon-download" data-href="' + safePath + '" data-filename="' + safeFile + '" aria-label="Скачать ' + safeName + '">' +
                '<img src="icon-download.svg" alt="">' +
              '</button>' +
            '</div>' +
          '</article>'
        );
      }

      function updateIconsLoadSentinel() {
        if (!iconsLoadSentinel) return;
        var hasMore = renderedIconsCount < renderedIcons.length;
        iconsLoadSentinel.classList.toggle("search-hidden", !hasMore);
      }

      function themeIconColorHex() {
        return document.documentElement.getAttribute("data-theme") === "dark" ? "#FFFFFF" : "#000000";
      }

      function applyIconColorForDownload(svgText, colorHex, sizePx) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(svgText, "image/svg+xml");
        var svg = doc.documentElement;
        if (!svg || svg.nodeName.toLowerCase() !== "svg") return svgText;

        svg.setAttribute("width", String(sizePx));
        svg.setAttribute("height", String(sizePx));
        svg.setAttribute("color", colorHex);

        var nodes = svg.querySelectorAll("*");
        nodes.forEach(function (node) {
          var fill = node.getAttribute("fill");
          if (fill && fill.toLowerCase() !== "none") {
            node.setAttribute("fill", colorHex);
          }
          var stroke = node.getAttribute("stroke");
          if (stroke && stroke.toLowerCase() !== "none") {
            node.setAttribute("stroke", colorHex);
          }
          var style = node.getAttribute("style");
          if (style) {
            var nextStyle = style
              .replace(/fill\s*:\s*(?!none\b)[^;]+/gi, "fill:" + colorHex)
              .replace(/stroke\s*:\s*(?!none\b)[^;]+/gi, "stroke:" + colorHex);
            node.setAttribute("style", nextStyle);
          }
        });

        var serializer = new XMLSerializer();
        return serializer.serializeToString(svg);
      }

      function triggerFileDownloadFromBlob(blob, filename) {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1500);
      }

      function appendIconsBatch() {
        if (!iconsGrid) return;
        if (renderedIconsCount >= renderedIcons.length) {
          updateIconsLoadSentinel();
          return;
        }
        var nextSlice = renderedIcons.slice(renderedIconsCount, renderedIconsCount + iconsPageSize);
        renderedIconsCount += nextSlice.length;
        iconsGrid.insertAdjacentHTML("beforeend", nextSlice.map(getIconCardMarkup).join(""));
        updateIconsLoadSentinel();
      }

      function getSearchContextText(tab) {
        if (tab === "basics") return "Поиск по основам";
        if (tab === "components") return "Поиск по компонентам";
        if (tab === "icons") return "Поиск по иконкам";
        return "Поиск";
      }

      function updateSearchContextLabel() {
        if (!hubSearchInput) return;
        var text = getSearchContextText(activeHubTab);
        hubSearchInput.placeholder = text;
        hubSearchInput.setAttribute("aria-label", text);
      }

      function renderIconsCatalog(query) {
        if (!iconsGrid) return;
        var q = (query || "").trim().toLowerCase();
        renderedIcons = allIcons.filter(function (filename) {
          return !q || getIconName(filename).toLowerCase().indexOf(q) !== -1;
        });
        renderedIconsCount = 0;
        iconsGrid.innerHTML = "";
        if (!renderedIcons.length) {
          iconsGrid.innerHTML = '<article class="icon-item"><p class="icon-name">Иконки не найдены</p></article>';
          updateIconsLoadSentinel();
          return;
        }
        appendIconsBatch();
      }

      function getPreviewMarkup(item) {
        if (item.category === "colors") {
          return '<div class="mini-preview"><span style="width:168px;height:92px;border-radius:14px;display:inline-block;background:linear-gradient(90deg,#0DC267 0 25%,#F8F8F8 25% 50%,#111111 50% 75%,#BED2C1 75% 100%);"></span></div>';
        }
        if (item.category === "tokens") {
          return '<div class="mini-preview"><div class="mini-typography"><p class="mini-type-title">Aa</p><p class="mini-type-body">Body 16 / Regular</p><p class="mini-type-caption">Caption 12</p></div></div>';
        }
        if (item.category === "radius") {
          return '<div class="mini-preview"><div class="mini-radius"><div class="mini-radius-row"><span class="mini-radius-box r8"></span><span class="mini-radius-box r16"></span><span class="mini-radius-box r24"></span></div><span class="mini-spacing"></span></div></div>';
        }
        switch (item.id) {
          case "section-intro":
            return '<div class="mini-preview"><div class="mini-card"><span class="mini-card-line"></span><span class="mini-card-line short"></span><span class="a11y-chip a11y-chip--ok" style="height:22px;font-size:11px;">Обзор и принципы</span></div></div>';
          case "section-accessibility":
            return '<div class="mini-preview"><div class="mini-card" style="width:168px;height:92px;justify-content:center;gap:8px;"><span class="a11y-chip a11y-chip--ok" style="height:22px;font-size:11px;">Readable</span><span class="a11y-chip a11y-chip--warn" style="height:22px;font-size:11px;">Contrast</span><span class="a11y-chip a11y-chip--danger" style="height:22px;font-size:11px;">States</span></div></div>';
          case "section-icons":
            return '<div class="mini-preview"><div class="mini-icon-swapper"><img src="icons/Acorn.svg" alt="" style="width:18px;height:18px;display:block"></div></div>';
          case "section-accordion":
            return '<div class="mini-preview"><span class="mini-accordion">Section <span style="opacity:.6">⌄</span></span></div>';
          case "section-bottomsheet":
            return '<div class="mini-preview"><div class="mini-bottomsheet"><span class="mini-bottomsheet-grabber"></span><div class="mini-row"><span class="mini-pill">×</span><span class="mini-preview-label">Title</span><span class="mini-pill green">•</span></div><span class="mini-btn" style="height:22px;min-width:100px;font-size:12px;">Button</span></div></div>';
          case "section-avatar":
          case "section-avatar-add-remove":
            return '<div class="mini-preview"><img src="avatar.svg" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover;display:block"></div>';
          case "section-checkbox":
            return '<div class="mini-preview"><span class="mini-check"></span><span style="font-size:12px;color:var(--text-secondary)">Label</span></div>';
          case "section-radio":
            return '<div class="mini-preview"><span class="mini-radio"></span><span style="font-size:12px;color:var(--text-secondary)">Option</span></div>';
          case "section-search":
            return '<div class="mini-preview"><span class="mini-search"><span class="mini-search-icon" aria-hidden="true"></span><span class="mini-search-text">Поиск</span></span></div>';
          case "section-select":
            return '<div class="mini-preview"><span class="mini-select">Select <span style="opacity:.65">⌄</span></span></div>';
          case "section-button":
            return '<div class="mini-preview"><span class="mini-btn" style="min-width:110px;height:24px;border-radius:10px;font-size:12px;">Button</span></div>';
          case "section-button-stack":
            return '<div class="mini-preview"><div class="mini-stack"><span class="mini-btn" style="min-width:82px;height:22px;border-radius:8px;font-size:11px;">Primary</span><span class="mini-btn mini-btn--secondary" style="min-width:82px;height:22px;border-radius:8px;font-size:11px;">Secondary</span></div></div>';
          case "section-card":
            return '<div class="mini-preview"><div class="mini-card"><span class="mini-card-line"></span><span class="mini-card-line short"></span></div></div>';
          case "section-card-stack":
            return '<div class="mini-preview"><div class="mini-card-stack"><div class="mini-card back"><span class="mini-card-line"></span><span class="mini-card-line short"></span></div><div class="mini-card front"><span class="mini-card-line"></span><span class="mini-card-line short"></span></div></div></div>';
          case "section-skeleton":
            return '<div class="mini-preview"><div class="mini-skeleton"><span class="mini-skeleton-bar w1"></span><span class="mini-skeleton-bar w2"></span><span class="mini-skeleton-bar w3"></span></div></div>';
          case "section-bubble-chat":
            return '<div class="mini-preview"><div class="mini-chat"><span class="mini-chat-bubble"></span><span class="mini-chat-bubble out"></span></div></div>';
          case "section-icon-swapper":
            return '<div class="mini-preview"><div class="mini-icon-swapper"><span style="font-size:16px;line-height:1;color:var(--text-secondary)">&lt;&gt;</span></div></div>';
          case "section-input":
          case "section-phone-input":
          case "section-date-input":
            return '<div class="mini-preview"><span class="mini-input">Input</span></div>';
          case "section-pincode-input":
            return '<div class="mini-preview"><span class="mini-pincode"><span class="mini-pincode-cell">1</span><span class="mini-pincode-cell">2</span><span class="mini-pincode-cell">3</span><span class="mini-pincode-cell active"></span><span class="mini-pincode-cell"></span><span class="mini-pincode-cell"></span></span></div>';
          case "section-snackbar":
            return '<div class="mini-preview"><span class="mini-snackbar">Нейтральное</span></div>';
          case "section-tabs":
          case "section-segmented-liquid":
            return '<div class="mini-preview"><div class="mini-tabs"><span class="mini-tab active">Tab</span><span class="mini-tab">Tab</span><span class="mini-tab">Tab</span></div></div>';
          case "section-toggle-ios26":
            return '<div class="mini-preview"><span class="mini-switch"></span></div>';
          case "section-loader":
            return '<div class="mini-preview"><span class="mini-pill" style="background:transparent;border:2px solid #0DC267;border-right-color:transparent;"></span></div>';
          case "section-progress-bar":
            return '<div class="mini-preview"><span class="mini-progress"><span class="mini-progress-bar"></span></span></div>';
          case "section-message-input":
            return '<div class="mini-preview"><span class="mini-pill">+</span><span class="mini-input" style="width:112px;">Сообщение</span><span class="mini-pill green">↗</span></div>';
          case "section-toolbar":
            return '<div class="mini-preview"><div class="mini-toolbar"><span class="mini-pill">‹</span><span class="mini-toolbar-title">Title</span><span class="mini-pill green">•</span></div></div>';
          case "section-sheet-topbar":
            return '<div class="mini-preview"><div class="mini-toolbar" style="border-radius:10px;height:34px;"><span class="mini-pill">×</span><span class="mini-toolbar-title">Title</span><span class="mini-pill green">•</span></div></div>';
          case "section-tabbar-liquid":
            return '<div class="mini-preview"><div class="mini-tabbar"><span class="mini-tabbar-item active"><span class="mini-tabbar-dot"></span><span>Label</span></span><span class="mini-tabbar-item"><span class="mini-tabbar-dot"></span><span>Label</span></span><span class="mini-tabbar-item"><span class="mini-tabbar-dot"></span><span>Label</span></span></div></div>';
          case "section-tags":
            return '<div class="mini-preview"><span class="mini-tab active">Tag</span><span class="mini-tab">Tag</span></div>';
          case "section-actionbar":
            return '<div class="mini-preview"><span class="mini-btn" style="height:24px;min-width:84px;font-size:12px;">Primary</span><span class="mini-btn mini-btn--secondary" style="height:24px;min-width:84px;font-size:12px;">Secondary</span></div>';
          default:
            return '<div class="mini-preview"><span class="mini-btn">Button</span></div>';
        }
      }

      function updateTabCounts() {
        var counts = { intro: 0, basics: 0, components: 0, accessibility: 0, icons: 0, colors: 0, tokens: 0, radius: 0 };
        hubItems.forEach(function (item) {
          if (counts[item.category] != null) counts[item.category] += 1;
        });
        counts.icons = allIcons.length;
        counts.basics = counts.colors + counts.tokens + counts.radius;
        Object.keys(counts).forEach(function (key) {
          var el = document.getElementById("hub-count-" + key);
          if (el) el.textContent = String(counts[key]);
        });
      }

      function renderHubCards() {
        if (!hubGrid) return;
        var query = hubSearchInput ? hubSearchInput.value.trim().toLowerCase() : "";
        hubGrid.innerHTML = "";
        var filtered = hubItems.filter(function (item) {
          var inTab = item.category === activeHubTab;
          if (activeHubTab === "basics") {
            inTab = item.category === "colors" || item.category === "tokens" || item.category === "radius";
          }
          var inSearch = !query || item.title.toLowerCase().indexOf(query) !== -1;
          return inTab && inSearch;
        });
        filtered.forEach(function (item) {
          var card = document.createElement("button");
          card.type = "button";
          card.className = "hub-card";
          card.dataset.target = item.id;
          card.innerHTML = (
            '<div class="hub-card-preview">' + getPreviewMarkup(item) + '</div>' +
            '<p class="hub-card-title">' + item.title + '</p>'
          );
          hubGrid.appendChild(card);
        });
        if (!filtered.length) {
          var empty = document.createElement("div");
          empty.className = "hub-card";
          empty.innerHTML = '<div class="hub-card-preview"><p class="hub-card-title">Ничего не найдено</p></div>';
          hubGrid.appendChild(empty);
        }
      }

      function openDetail(sectionId) {
        if (!detailScroll || !hubOverview || !detailHeader || !detailTitle) return;
        var target = document.getElementById(sectionId);
        if (!target) return;
        Array.from(detailScroll.children).forEach(function (node) {
          node.classList.add("search-hidden");
        });
        target.classList.remove("search-hidden");
        var titleNode = target.querySelector("h2");
        detailTitle.textContent = titleNode ? titleNode.textContent : "Компонент";
        hubOverview.classList.add("search-hidden");
        detailScroll.classList.remove("search-hidden");
        detailHeader.classList.remove("search-hidden");
        if (sectionId === "section-icons" || sectionId === "section-intro" || sectionId === "section-accessibility") {
          detailHeader.classList.add("search-hidden");
        }
        if (sectionId !== "section-icons" && iconsGrid) {
          iconsGrid.innerHTML = "";
          renderedIcons = [];
          renderedIconsCount = 0;
          updateIconsLoadSentinel();
        }
        document.body.classList.toggle("icons-sticky-tools", sectionId === "section-icons");
        if (detailBackBtn) {
          var isRootSection = sectionId === "section-intro" || sectionId === "section-accessibility" || sectionId === "section-icons";
          detailBackBtn.classList.toggle("search-hidden", isRootSection);
          document.body.classList.toggle("detail-root-mode", isRootSection);
          var hideSearchForRoot = sectionId === "section-intro" || sectionId === "section-accessibility";
          document.body.classList.toggle("root-hide-search", hideSearchForRoot);
        }
        document.body.classList.add("detail-mode");
        window.scrollTo({ top: 0, behavior: "auto" });
        history.replaceState(null, "", "#" + sectionId);
      }

      function openOverview() {
        if (!detailScroll || !hubOverview || !detailHeader) return;
        Array.from(detailScroll.children).forEach(function (node) {
          node.classList.remove("search-hidden");
        });
        detailScroll.classList.add("search-hidden");
        detailHeader.classList.add("search-hidden");
        if (detailBackBtn) detailBackBtn.classList.remove("search-hidden");
        document.body.classList.remove("detail-root-mode");
        document.body.classList.remove("root-hide-search");
        document.body.classList.remove("icons-sticky-tools");
        hubOverview.classList.remove("search-hidden");
        document.body.classList.remove("detail-mode");
        updateSearchContextLabel();
        history.replaceState(null, "", "#");
      }

      if (detailScroll) {
        hubItems = Array.from(detailScroll.querySelectorAll("section")).map(function (section) {
          var id = section.id;
          var titleNode = section.querySelector("h2");
          var title = titleNode ? titleNode.textContent.trim() : id;
          if (id === "section-intro") title = "Обзор и принципы";
          var category = getCategoryById(id);
          return {
            id: id,
            title: title,
            category: category
          };
        });
      }

      updateTabCounts();
      renderHubCards();

      if (hubTabs) {
        hubTabs.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var button = target.closest(".hub-tab");
          if (!button) return;
          activeHubTab = button.getAttribute("data-tab") || "intro";
          updateSearchContextLabel();
          hubTabs.querySelectorAll(".hub-tab").forEach(function (tab) {
            tab.classList.toggle("active", tab === button);
          });
          if (activeHubTab === "intro") {
            openDetail("section-intro");
            return;
          }
          if (activeHubTab === "accessibility") {
            openDetail("section-accessibility");
            return;
          }
          if (activeHubTab === "icons") {
            openDetail("section-icons");
            renderIconsCatalog(hubSearchInput ? hubSearchInput.value : "");
            return;
          }
          openOverview();
          renderHubCards();
        });
      }

      if (hubSearchInput) {
        hubSearchInput.addEventListener("input", function () {
          if (hubSearchDebounceTimer) clearTimeout(hubSearchDebounceTimer);
          hubSearchDebounceTimer = setTimeout(function () {
            hubSearchDebounceTimer = null;
            if (document.body.classList.contains("detail-root-mode") && window.location.hash === "#section-icons") {
              renderIconsCatalog(hubSearchInput.value);
              return;
            }
            renderHubCards();
          }, 120);
        });
      }

      if (iconsGrid) {
        if ("IntersectionObserver" in window && iconsLoadSentinel) {
          iconsLoadObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              if (!document.body.classList.contains("detail-root-mode")) return;
              if (window.location.hash !== "#section-icons") return;
              appendIconsBatch();
            });
          }, {
            root: null,
            rootMargin: "640px 0px 640px 0px",
            threshold: 0.01
          });
          iconsLoadObserver.observe(iconsLoadSentinel);
        } else {
          window.addEventListener("scroll", function () {
            if (!document.body.classList.contains("detail-root-mode")) return;
            if (window.location.hash !== "#section-icons") return;
            if (!iconsLoadSentinel || iconsLoadSentinel.classList.contains("search-hidden")) return;
            var rect = iconsLoadSentinel.getBoundingClientRect();
            if (rect.top <= window.innerHeight + 640) appendIconsBatch();
          }, { passive: true });
        }

        iconsGrid.addEventListener("change", function (event) {
          var target = event.target;
          if (!(target instanceof HTMLSelectElement)) return;
          if (!target.classList.contains("icon-size-select")) return;
          var card = target.closest(".icon-item");
          if (!card) return;
          var icon = card.querySelector(".icon-preview-img");
          if (!icon) return;
          var size = target.value || "32";
          icon.style.width = size + "px";
          icon.style.height = size + "px";
        });

        iconsGrid.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var link = target.closest(".icon-download");
          if (!(link instanceof HTMLButtonElement)) return;
          var href = link.getAttribute("data-href");
          if (!href) return;
          var filename = link.getAttribute("data-filename") || (href.split("/").pop() || "icon.svg");
          var card = link.closest(".icon-item");
          var sizeSelect = card ? card.querySelector(".icon-size-select") : null;
          var size = parseInt(sizeSelect && sizeSelect.value ? sizeSelect.value : "32", 10);
          var exportSize = isNaN(size) ? 32 : size;
          var exportColor = themeIconColorHex();
          fetch(href).then(function (res) {
            if (!res.ok) throw new Error("download-failed");
            return res.text();
          }).then(function (svgText) {
            var preparedSvg = applyIconColorForDownload(svgText, exportColor, exportSize);
            var blob = new Blob([preparedSvg], { type: "image/svg+xml;charset=utf-8" });
            triggerFileDownloadFromBlob(blob, filename);
          }).catch(function () {
            fetch(href).then(function (res) {
              if (!res.ok) throw new Error("download-failed-fallback");
              return res.blob();
            }).then(function (blob) {
              triggerFileDownloadFromBlob(blob, filename);
            }).catch(function () {
              // fail silently to avoid opening icon in a new page
            });
          });
        });
      }

      if (hubGrid) {
        hubGrid.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var card = target.closest(".hub-card");
          if (!card) return;
          var id = card.getAttribute("data-target");
          if (id) openDetail(id);
        });
      }

      if (detailBackBtn) {
        detailBackBtn.addEventListener("click", openOverview);
      }

      document.querySelectorAll(".intro-quick-btn").forEach(function (button) {
        button.addEventListener("click", function () {
          var tabTarget = button.getAttribute("data-tab-target");
          if (!tabTarget || !hubTabs) return;
          var tabButton = hubTabs.querySelector('[data-tab="' + tabTarget + '"]');
          if (!tabButton) return;
          tabButton.click();
        });
      });

      var initialHash = (window.location.hash || "").replace("#", "");
      if (initialHash && document.getElementById(initialHash)) {
        openDetail(initialHash);
        if (initialHash === "section-icons") {
          activeHubTab = "icons";
          updateSearchContextLabel();
          if (hubTabs) {
            var iconsBtn = hubTabs.querySelector('[data-tab="icons"]');
            if (iconsBtn) hubTabs.querySelectorAll(".hub-tab").forEach(function (tab) { tab.classList.toggle("active", tab === iconsBtn); });
          }
          renderIconsCatalog(hubSearchInput ? hubSearchInput.value : "");
        }
      } else {
        openDetail("section-intro");
        if (hubTabs) {
          var introBtn = hubTabs.querySelector('[data-tab="intro"]');
          if (introBtn) {
            hubTabs.querySelectorAll(".hub-tab").forEach(function (tab) { tab.classList.toggle("active", tab === introBtn); });
          }
        }
        activeHubTab = "intro";
      }

      updateSearchContextLabel();

      var bottomsheetVariant = document.getElementById("bottomsheet-variant");
      var bottomsheetShell = document.getElementById("bottomsheet-live-shell");
      var bottomsheetBody = document.getElementById("bottomsheet-live-body");
      function updateBottomsheet() {
        if (!bottomsheetShell || !bottomsheetBody) return;
        var v = bottomsheetVariant && bottomsheetVariant.value === "full";
        bottomsheetShell.style.height = v ? "812px" : "451px";
        bottomsheetBody.style.height = v ? "708px" : "348px";
        bottomsheetShell.classList.toggle("bottomsheet-shell--full", v);
        bottomsheetShell.classList.toggle("bottomsheet-shell--compact", !v);
        var swapper = bottomsheetBody.querySelector(".bottomsheet-swapper");
        if (swapper) {
          swapper.style.flex = v ? "0 0 auto" : "";
          swapper.style.height = v ? "552px" : "";
          swapper.style.width = v ? "343px" : "";
        }
      }
      if (bottomsheetVariant) bottomsheetVariant.addEventListener("change", updateBottomsheet);
      updateBottomsheet();

      var snackbarType = document.getElementById("snackbar-type");
      var snackbarTextInput = document.getElementById("snackbar-text");
      var snackbarLive = document.getElementById("snackbar-live");
      var snackbarMessages = { success: "Что-то хорошее произошло", danger: "Что-то плохое произошло", default: "Нейтральное" };
      function updateSnackbar() {
        if (!snackbarLive) return;
        var t = snackbarType ? snackbarType.value : "default";
        if (!snackbarMessages[t]) t = "default";
        var text = (snackbarTextInput && snackbarTextInput.value.trim()) || snackbarMessages[t];
        snackbarLive.textContent = text;
        snackbarLive.className = "snackbar snackbar--" + t;
      }
      if (snackbarType) snackbarType.addEventListener("change", updateSnackbar);
      if (snackbarTextInput) snackbarTextInput.addEventListener("input", updateSnackbar);
      updateSnackbar();

      var avatarLive = document.getElementById("avatar-live");
      var avatarSize = document.getElementById("avatar-size");
      var avatarShape = document.getElementById("avatar-shape");
      var avatarMode = document.getElementById("avatar-mode");
      function updateAvatar() {
        if (!avatarLive) return;
        var size = (avatarSize && avatarSize.value) || "48";
        var shape = (avatarShape && avatarShape.value) || "circle";
        var mode = (avatarMode && avatarMode.value) || "letters";
        var classes = ["avatar", "avatar--" + shape, "avatar--" + size, "avatar--" + mode];
        avatarLive.className = classes.join(" ");
        avatarLive.style.opacity = "0.7";
        requestAnimationFrame(function () {
          if (mode === "image") {
            avatarLive.innerHTML = '<img src="avatar-image.svg" alt="" class="avatar-img">';
          } else if (mode === "placeholder") {
            avatarLive.innerHTML = '<img src="avatar-placeholder-man.svg" alt="" class="avatar-img">';
          } else {
            avatarLive.textContent = mode === "letters" ? "БЯ" : mode === "icon" ? "◆" : "";
          }
          requestAnimationFrame(function () {
            avatarLive.style.opacity = "1";
          });
        });
      }
      if (avatarSize) avatarSize.addEventListener("change", updateAvatar);
      if (avatarShape) avatarShape.addEventListener("change", updateAvatar);
      if (avatarMode) avatarMode.addEventListener("change", updateAvatar);
      updateAvatar();

      var avatarArSize = document.getElementById("avatar-ar-size");
      var avatarArState = document.getElementById("avatar-ar-state");
      var avatarArLive = document.getElementById("avatar-ar-live");
      var avatarArPlaceholder = document.getElementById("avatar-ar-placeholder");
      var avatarArImg = document.getElementById("avatar-ar-img");
      var avatarArAction = document.getElementById("avatar-ar-action");
      var avatarArActionIcon = document.getElementById("avatar-ar-action-icon");
      var avatarArFile = document.getElementById("avatar-ar-file");
      var avatarArStorageKey = "avatar-ar-custom-image";
      var avatarArCustomSrc = "";
      var avatarArHasCustomImage = false;
      var defaultAvatarArSrc = ".figma-assets/abc10c9f1a60e18581af7919629dd66f7b7376fe.png";
      var avatarArAddIconSrc = "icon-swapper.svg";
      var avatarArRemoveIconSrc = "icon-swapper-1.svg";

      function readAvatarArStoredImage() {
        try {
          var value = localStorage.getItem(avatarArStorageKey);
          return value || "";
        } catch (e) {
          return "";
        }
      }

      function writeAvatarArStoredImage(dataUrl) {
        try {
          if (dataUrl) {
            localStorage.setItem(avatarArStorageKey, dataUrl);
          } else {
            localStorage.removeItem(avatarArStorageKey);
          }
        } catch (e) {}
      }

      function clearAvatarArCustomImage() {
        avatarArHasCustomImage = false;
        avatarArCustomSrc = "";
        writeAvatarArStoredImage("");
        if (avatarArFile) avatarArFile.value = "";
      }

      function renderAvatarAddRemove(animate) {
        if (!avatarArLive || !avatarArState || !avatarArSize || !avatarArImg || !avatarArPlaceholder || !avatarArAction || !avatarArActionIcon) return;
        var size = avatarArSize.value || "96";
        var state = avatarArState.value || "add";
        var isAdd = state === "add";
        var isBig = size === "208";
        var showImage = !isAdd;

        avatarArLive.className = "avatar-addremove-live" + (isBig ? " avatar-addremove-live--208" : "");
        avatarArPlaceholder.hidden = showImage;
        avatarArImg.hidden = !showImage;
        avatarArAction.className = "avatar-addremove-action " + (isAdd ? "avatar-addremove-action--add" : "avatar-addremove-action--remove");
        avatarArAction.setAttribute("aria-label", isAdd ? "Добавить аватарку" : "Удалить аватарку");

        if (showImage) {
          avatarArImg.src = avatarArHasCustomImage && avatarArCustomSrc ? avatarArCustomSrc : defaultAvatarArSrc;
          avatarArActionIcon.innerHTML = '<img class="avatar-ar-action-icon-img" src="' + avatarArRemoveIconSrc + '" alt="">';
        } else {
          avatarArImg.removeAttribute("src");
          avatarArActionIcon.innerHTML = '<img class="avatar-ar-action-icon-img" src="' + avatarArAddIconSrc + '" alt="">';
        }

        if (animate) {
          avatarArLive.style.opacity = "0.72";
          setTimeout(function () {
            if (avatarArLive) avatarArLive.style.opacity = "1";
          }, 150);
        }
      }

      function openAvatarArPicker() {
        if (!avatarArFile) return;
        avatarArFile.click();
      }

      if (avatarArSize) avatarArSize.addEventListener("change", function () { renderAvatarAddRemove(true); });
      if (avatarArState) avatarArState.addEventListener("change", function () {
        if (avatarArState.value === "add") clearAvatarArCustomImage();
        renderAvatarAddRemove(true);
      });
      if (avatarArAction) avatarArAction.addEventListener("click", function () {
        if (!avatarArState || !avatarArFile) return;
        if (avatarArState.value === "add") {
          openAvatarArPicker();
          return;
        }
        clearAvatarArCustomImage();
        avatarArState.value = "add";
        renderAvatarAddRemove(true);
      });
      if (avatarArLive) avatarArLive.addEventListener("click", function () { openAvatarArPicker(); });
      if (avatarArFile) avatarArFile.addEventListener("change", function () {
        var file = avatarArFile.files && avatarArFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var result = typeof reader.result === "string" ? reader.result : "";
          if (!result) return;
          avatarArHasCustomImage = true;
          avatarArCustomSrc = result;
          writeAvatarArStoredImage(result);
          if (avatarArState) avatarArState.value = "change";
          renderAvatarAddRemove(true);
        };
        reader.readAsDataURL(file);
      });

      var storedAvatarArImage = readAvatarArStoredImage();
      if (storedAvatarArImage) {
        avatarArHasCustomImage = true;
        avatarArCustomSrc = storedAvatarArImage;
        if (avatarArState) avatarArState.value = "change";
      }
      renderAvatarAddRemove(false);

      var actionbarSwapperWrap = document.getElementById("actionbar-swapper-wrap");
      var actionbarBtn2 = document.getElementById("actionbar-btn-2");
      var actionbarBtn3 = document.getElementById("actionbar-btn-3");
      var actionbarHomeWrap = document.getElementById("actionbar-home-wrap");
      var actionbarButtons = document.getElementById("actionbar-buttons");
      var actionbarContent = document.getElementById("actionbar-content");
      var actionbarHome = document.getElementById("actionbar-home");
      function updateActionbar() {
        var n = parseInt((actionbarButtons && actionbarButtons.value) || "1", 10);
        if (n < 1 || n > 3) n = 1;
        var hasContent = actionbarContent && actionbarContent.value === "yes";
        var hasHome = actionbarHome && actionbarHome.value === "yes";
        if (actionbarSwapperWrap) actionbarSwapperWrap.classList.toggle("actionbar--hidden", !hasContent);
        if (actionbarBtn2) actionbarBtn2.classList.toggle("actionbar--hidden", n < 2);
        if (actionbarBtn3) actionbarBtn3.classList.toggle("actionbar--hidden", n < 3);
        if (actionbarHomeWrap) actionbarHomeWrap.classList.toggle("actionbar--hidden", !hasHome);
      }
      if (actionbarButtons) actionbarButtons.addEventListener("change", updateActionbar);
      if (actionbarContent) actionbarContent.addEventListener("change", updateActionbar);
      if (actionbarHome) actionbarHome.addEventListener("change", updateActionbar);
      updateActionbar();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var colorCards = document.querySelectorAll(".color-card");
      var toast = document.getElementById("copy-snackbar");
      var toastTimer = null;
      function showToast() {
        if (!toast) return;
        toast.classList.add("copy-snackbar--visible");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          toast.classList.remove("copy-snackbar--visible");
        }, 1200);
      }
      function copyHexFromCard(card) {
        if (!card) return;
        var hexEl = card.querySelector(".color-card-hex");
        if (!hexEl) return;
        var hex = (hexEl.textContent || "").trim();
        if (!hex) return;
        if (hex.charAt(0) !== "#") hex = "#" + hex;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(hex).catch(function () {});
        } else {
          var ta = document.createElement("textarea");
          ta.value = hex;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try { document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta);
        }
        colorCards.forEach(function (c) { c.classList.remove("color-card--copied"); });
        card.classList.add("color-card--copied");
        setTimeout(function () {
          card.classList.remove("color-card--copied");
        }, 800);
        showToast();
      }
      colorCards.forEach(function (card) {
        card.addEventListener("click", function () {
          copyHexFromCard(card);
        });
      });
    });
    document.addEventListener("DOMContentLoaded", function () {
      var liveBtn = document.getElementById("live-button");
      var btnTextInput = document.getElementById("btn-text");
      var typeSelect = document.getElementById("btn-type");
      var stateSelect = document.getElementById("btn-state");
      var iconSelect = document.getElementById("btn-icon");
      var sizeSelect = document.getElementById("btn-size");
      function updateButton() {
        if (!liveBtn || !typeSelect) return;
        var type = typeSelect.value;
        var state = stateSelect.value;
        var icon = iconSelect.value;
        var size = sizeSelect.value;
        var classList = liveBtn.classList;
        ["primary","secondary","tertiary","danger"].forEach(function(c){ classList.remove("live-btn--" + c); });
        classList.add("live-btn--" + type);
        ["xs","s","m","l"].forEach(function(c){ classList.remove("live-btn--" + c); });
        classList.add("live-btn--" + size);
        ["disabled","loading"].forEach(function(c){ classList.remove("live-btn--" + c); });
        if (state === "disabled") classList.add("live-btn--disabled");
        if (state === "loading") classList.add("live-btn--loading");
        var label = state === "loading" ? "Loading…" : (btnTextInput && btnTextInput.value.trim()) || "Button";
        if (icon === "yes") {
          liveBtn.innerHTML = '<span class="btn-icon">◆</span><span class="btn-text"></span>';
          var textEl = liveBtn.querySelector(".btn-text");
          if (textEl) textEl.textContent = label;
        } else {
          liveBtn.innerHTML = '<span class="btn-text"></span>';
          var textEl2 = liveBtn.querySelector(".btn-text");
          if (textEl2) textEl2.textContent = label;
        }
      }
      if (btnTextInput) btnTextInput.addEventListener("input", updateButton);
      if (typeSelect) typeSelect.addEventListener("change", updateButton);
      if (stateSelect) stateSelect.addEventListener("change", updateButton);
      if (iconSelect) iconSelect.addEventListener("change", updateButton);
      if (sizeSelect) sizeSelect.addEventListener("change", updateButton);
      updateButton();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var stackEl = document.getElementById("buttonstack-live");
      var stackCount = document.getElementById("buttonstack-count");
      var stackType = document.getElementById("buttonstack-type");
      var stackFlip = document.getElementById("buttonstack-flip");
      function updateButtonStack() {
        if (!stackEl) return;
        var count = parseInt((stackCount && stackCount.value) || "2", 10);
        if (count < 1 || count > 3) count = 2;
        var type = (stackType && stackType.value) || "vertical";
        var flip = (stackFlip && stackFlip.value) === "yes";
        var btns = stackEl.querySelectorAll(".button-stack__btn");
        stackEl.className = "button-stack button-stack--" + type + " button-stack--count-" + count;
        var types = count === 1 ? ["primary"] : count === 2
          ? (flip ? ["secondary", "primary"] : ["primary", "secondary"])
          : (flip ? ["tertiary", "secondary", "primary"] : ["primary", "secondary", "tertiary"]);
        btns.forEach(function (btn, i) {
          if (!btn.classList.contains("live-btn")) return;
          ["primary", "secondary", "tertiary"].forEach(function (c) { btn.classList.remove("live-btn--" + c); });
          if (i < types.length) btn.classList.add("live-btn--" + types[i]);
          var shouldShow = i < count;
          btn.classList.toggle("button-stack__btn--hidden", !shouldShow);
        });
      }
      if (stackCount) stackCount.addEventListener("change", updateButtonStack);
      if (stackType) stackType.addEventListener("change", updateButtonStack);
      if (stackFlip) stackFlip.addEventListener("change", updateButtonStack);
      updateButtonStack();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var cardDemo = document.getElementById("card-demo");
      var cardState = document.getElementById("card-state");
      function updateCard() {
        if (!cardDemo) return;
        var state = (cardState && cardState.value) || "default";
        cardDemo.classList.remove("card-demo--pressed");
        if (state === "pressed") cardDemo.classList.add("card-demo--pressed");
      }
      if (cardState) cardState.addEventListener("change", updateCard);
      updateCard();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var cardStackEl = document.getElementById("cardstack-live");
      var cardStackCount = document.getElementById("cardstack-count");
      var cardStackType = document.getElementById("cardstack-type");
      function updateCardStack() {
        if (!cardStackEl) return;
        var count = parseInt((cardStackCount && cardStackCount.value) || "2", 10);
        if (count < 1 || count > 3) count = 2;
        var type = (cardStackType && cardStackType.value) || "vertical";
        cardStackEl.className = "card-stack" + (type === "horizontal" ? " card-stack--horizontal" : "");
        var cards = cardStackEl.querySelectorAll(".card-stack__card");
        cards.forEach(function (card, i) {
          card.classList.toggle("card-stack__card--hidden", i >= count);
        });
      }
      if (cardStackCount) cardStackCount.addEventListener("change", updateCardStack);
      if (cardStackType) cardStackType.addEventListener("change", updateCardStack);
      updateCardStack();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var searchDemo = document.getElementById("search-demo");
      var searchInput = document.getElementById("search-input");
      var searchFilled = document.getElementById("search-filled");
      var searchSize = document.getElementById("search-size");
      var searchIconVariant = document.getElementById("search-icon-variant");
      var searchFilter = document.getElementById("search-filter");
      var searchState = document.getElementById("search-state");
      function updateSearchDemo() {
        if (!searchDemo) return;
        var filled = (searchFilled && searchFilled.value) || "no";
        var size = (searchSize && searchSize.value) || "m";
        var iconVariant = (searchIconVariant && searchIconVariant.value) || "brand";
        var hasFilter = ((searchFilter && searchFilter.value) || "yes") === "yes";
        var state = (searchState && searchState.value) || "default";
        searchDemo.className = "search-demo";
        searchDemo.classList.add("search-demo--size-" + size);
        searchDemo.classList.add("search-demo--icon-" + iconVariant);
        searchDemo.classList.toggle("search-demo--no-filter", !hasFilter);
        if (filled === "yes") {
          searchDemo.classList.add("search-demo--filled");
        }
        if (state === "focused") {
          searchDemo.classList.add("search-demo--focused");
        } else if (state === "disabled") {
          searchDemo.classList.add("search-demo--disabled");
        }
        if (searchInput) {
          var isFilled = filled === "yes";
          if (state === "focused" && !isFilled) {
            searchInput.value = "label";
          } else {
            searchInput.value = isFilled ? "content" : "";
          }
          searchInput.placeholder = "label";
          searchInput.disabled = state === "disabled";
          searchInput.readOnly = state === "disabled";
          if (state === "focused" && state !== "disabled") {
            requestAnimationFrame(function () {
              if (!searchInput) return;
              searchInput.focus();
              var caretPos = searchInput.value.length;
              try { searchInput.setSelectionRange(caretPos, caretPos); } catch (e) {}
            });
          } else {
            searchInput.blur();
          }
        }
      }
      if (searchFilled) searchFilled.addEventListener("change", updateSearchDemo);
      if (searchSize) searchSize.addEventListener("change", updateSearchDemo);
      if (searchIconVariant) searchIconVariant.addEventListener("change", updateSearchDemo);
      if (searchFilter) searchFilter.addEventListener("change", updateSearchDemo);
      if (searchState) searchState.addEventListener("change", updateSearchDemo);
      if (searchInput) {
        searchInput.addEventListener("focus", function () {
          if (!searchDemo) return;
          if (!searchState || searchState.value === "default") {
            searchDemo.classList.add("search-demo--focused");
          }
        });
        searchInput.addEventListener("blur", function () {
          if (!searchDemo) return;
          if (!searchState || searchState.value === "default") {
            searchDemo.classList.remove("search-demo--focused");
          }
        });
      }
      updateSearchDemo();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var textDemo = document.getElementById("text-input-demo");
      var textInput = document.getElementById("text-input");
      var textLabelInput = document.getElementById("text-label");
      var textInputLabel = document.getElementById("text-input-label");
      var textFilled = document.getElementById("text-filled");
      var textState = document.getElementById("text-state");
      var textHelper = document.getElementById("text-helper");
      var textSize = document.getElementById("text-size");
      var textHelperText = document.getElementById("text-helper-text");
      function getTextInputWidth(state, filled, helper, size) {
        return 375;
      }
      function getTextInputFieldHeight(state, filled, size) {
        if (size === "xs") return filled === "yes" ? 38 : 40;
        if (size === "s") return 48;
        if (filled === "yes" && state === "focused") return 54;
        return 56;
      }
      function updateTextDemo() {
        if (!textDemo) return;
        var state = (textState && textState.value) || "default";
        var filled = (textFilled && textFilled.value) || "no";
        var helper = (textHelper && textHelper.value) || "no";
        var size = (textSize && textSize.value) || "m";
        var isDark = document.documentElement.getAttribute("data-theme") === "dark";
        var hasHelper = helper === "yes";
        var isFocused = state === "focused";
        var isDisabled = state === "disabled";
        var isDanger = state === "danger";
        var isFilled = filled === "yes";
        var hasValue = !!(textInput && textInput.value);
        var shouldFloat = isFilled || isFocused || hasValue;
        var width = getTextInputWidth(state, filled, helper, size);
        var fieldHeight = getTextInputFieldHeight(state, filled, size);
        var padX = size === "xs" ? 12 : 16;
        var padY = size === "xs" ? 8 : (size === "s" ? 12 : (shouldFloat ? 8 : 16));
        textDemo.className = "text-input-demo";
        textDemo.classList.add("text-input-demo--size-" + size);
        if (isFilled) textDemo.classList.add("text-input-demo--filled");
        if (hasHelper) textDemo.classList.add("text-input-demo--has-helper");
        if (shouldFloat) textDemo.classList.add("text-input-demo--floating");
        if (isFocused) {
          textDemo.classList.add("text-input-demo--focused");
        } else if (isDisabled) {
          textDemo.classList.add("text-input-demo--disabled");
        } else if (isDanger) {
          textDemo.classList.add("text-input-demo--danger");
        }
        if (isDanger && hasHelper) textDemo.classList.add("text-input-demo--danger");
        textDemo.style.setProperty("--input-demo-width", width + "px");
        textDemo.style.setProperty("--input-demo-height", fieldHeight + "px");
        textDemo.style.setProperty("--input-demo-padding-x", padX + "px");
        textDemo.style.setProperty("--input-demo-padding-y", padY + "px");
        textDemo.style.setProperty("--input-demo-bg", isDark ? (isDisabled ? "#1F1F1F" : "#1B1B1B") : (isDisabled ? "#F1F1F1" : "#F8F8F8"));
        textDemo.style.setProperty("--input-demo-border", isFocused ? "#0DC267" : (isDanger ? "#FF4D3A" : (isDisabled ? "#3A3A3A" : (isDark ? "#3A3A3A" : "#E2E2E2"))));
        textDemo.style.setProperty("--input-demo-text", (isDanger && isFilled) ? "#FF4D3A" : (isDisabled ? (isDark ? "#6E6E6E" : "#C6C6C6") : (isDark ? "#FFFFFF" : "#111111")));
        textDemo.style.setProperty("--input-demo-caret", (isDanger && isFilled) ? "#FF4D3A" : (isDisabled ? (isDark ? "#6E6E6E" : "#C6C6C6") : (isDark ? "#FFFFFF" : "#111111")));
        if (textHelperText) {
          if (hasHelper) {
            textHelperText.textContent = "helper text";
          } else {
            textHelperText.textContent = "";
          }
        }
        if (textInputLabel) {
          var nextLabel = (textLabelInput && textLabelInput.value.trim()) || "label";
          textInputLabel.textContent = nextLabel;
        }
        if (textInput) {
          if (isDisabled) {
            textInput.blur();
          }
          if (!textInput.value && (isFilled || isFocused)) {
            textInput.value = isFocused && size === "m" ? "cods|" : "content";
            textInput.dataset.autoValue = "1";
          }
          if (!isFilled && !isFocused && textInput.dataset.autoValue === "1") {
            textInput.value = "";
            textInput.dataset.autoValue = "0";
          }
          textInput.disabled = isDisabled;
        }
      }
      if (textState) textState.addEventListener("change", updateTextDemo);
      if (textFilled) textFilled.addEventListener("change", updateTextDemo);
      if (textHelper) textHelper.addEventListener("change", updateTextDemo);
      if (textSize) textSize.addEventListener("change", updateTextDemo);
      if (textLabelInput) textLabelInput.addEventListener("input", updateTextDemo);
      document.addEventListener("storybook-theme-change", updateTextDemo);
      if (textInput) {
        textInput.addEventListener("focus", function () {
          if (!textDemo) return;
          if (!textState || textState.value === "default") {
            textDemo.classList.add("text-input-demo--focused");
          }
        });
        textInput.addEventListener("blur", function () {
          if (!textDemo) return;
          if (!textState || textState.value === "default") {
            textDemo.classList.remove("text-input-demo--focused");
          }
        });
        textInput.addEventListener("input", function () {
          textInput.dataset.autoValue = "0";
          updateTextDemo();
        });
      }
      updateTextDemo();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var checkboxDemo = document.getElementById("checkbox-demo");
      var checkboxVariant = document.getElementById("checkbox-variant");
      var checkboxChecked = document.getElementById("checkbox-checked");
      function applyCheckboxState(variant, checked) {
        if (!checkboxDemo) return;
        checkboxDemo.classList.remove("checkbox-demo--checked", "checkbox-demo--disabled", "checkbox-demo--danger");
        var isChecked = checked === "yes";
        var isDisabled = variant === "disabled";
        var isDanger = variant === "danger";
        if (isChecked) checkboxDemo.classList.add("checkbox-demo--checked");
        if (isDisabled) checkboxDemo.classList.add("checkbox-demo--disabled");
        if (isDanger) checkboxDemo.classList.add("checkbox-demo--danger");
        checkboxDemo.setAttribute("aria-checked", isChecked ? "true" : "false");
        checkboxDemo.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      }
      function updateCheckboxFromControls() {
        var variant = (checkboxVariant && checkboxVariant.value) || "default";
        var checked = (checkboxChecked && checkboxChecked.value) || "no";
        applyCheckboxState(variant, checked);
      }
      function toggleCheckbox() {
        if (!checkboxChecked || !checkboxVariant) return;
        var variant = checkboxVariant.value;
        if (variant === "disabled") return;
        var currentChecked = checkboxChecked.value;
        checkboxChecked.value = currentChecked === "yes" ? "no" : "yes";
        updateCheckboxFromControls();
      }
      if (checkboxVariant) checkboxVariant.addEventListener("change", updateCheckboxFromControls);
      if (checkboxChecked) checkboxChecked.addEventListener("change", updateCheckboxFromControls);
      if (checkboxDemo) {
        checkboxDemo.addEventListener("click", toggleCheckbox);
      }
      updateCheckboxFromControls();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var radioDemo = document.getElementById("radio-demo");
      var radioState = document.getElementById("radio-state");
      var radioChecked = document.getElementById("radio-checked");

      function applyRadioState() {
        if (!radioDemo) return;
        var state = (radioState && radioState.value) || "default";
        var checked = (radioChecked && radioChecked.value) || "yes";

        if (state === "danger" && radioChecked) {
          radioChecked.value = "no";
          checked = "no";
        }
        if (state === "disabled" && radioChecked && checked !== "yes" && checked !== "no" && checked !== "false") {
          radioChecked.value = "no";
          checked = "no";
        }

        var isChecked = checked === "yes";
        var isDisabled = state === "disabled";
        var isDanger = state === "danger";

        radioDemo.classList.remove("radio-demo--checked", "radio-demo--disabled", "radio-demo--danger");
        if (isChecked) radioDemo.classList.add("radio-demo--checked");
        if (isDisabled) radioDemo.classList.add("radio-demo--disabled");
        if (isDanger) radioDemo.classList.add("radio-demo--danger");

        radioDemo.setAttribute("aria-checked", isChecked ? "true" : "false");
        radioDemo.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      }

      function toggleRadio() {
        if (!radioDemo || !radioState || !radioChecked) return;
        if (radioState.value === "disabled" || radioState.value === "danger") return;
        radioChecked.value = "yes";
        applyRadioState();
      }

      if (radioState) radioState.addEventListener("change", applyRadioState);
      if (radioChecked) radioChecked.addEventListener("change", applyRadioState);
      if (radioDemo) radioDemo.addEventListener("click", toggleRadio);
      applyRadioState();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var dateDemo = document.getElementById("date-demo");
      var dateState = document.getElementById("date-state");
      var dateFilled = document.getElementById("date-filled");
      var dateHelper = document.getElementById("date-helper");
      var dateSize = document.getElementById("date-size");
      var dateHelperText = document.getElementById("date-helper-text");
      var dateValue = document.getElementById("date-value");
      function updateDateDemo() {
        if (!dateDemo) return;
        var state = (dateState && dateState.value) || "default";
        var filled = (dateFilled && dateFilled.value) || "no";
        var helper = (dateHelper && dateHelper.value) || "no";
        var size = (dateSize && dateSize.value) || "m";
        dateDemo.className = "date-input-demo";
        dateDemo.classList.add("date-input-demo--size-" + size);
        if (filled === "yes") {
          dateDemo.classList.add("date-input-demo--filled");
        }
        if (helper === "yes") {
          dateDemo.classList.add("date-input-demo--has-helper");
        }
        if (state === "focused") {
          dateDemo.classList.add("date-input-demo--focused");
        } else if (state === "disabled") {
          dateDemo.classList.add("date-input-demo--disabled");
        } else if (state === "danger") {
          dateDemo.classList.add("date-input-demo--danger");
        }
        if (dateHelperText) {
          if (helper === "yes") {
            dateHelperText.textContent = state === "danger" ? "Ошибка: неверная дата" : "helper text";
          } else {
            dateHelperText.textContent = "";
          }
        }
        if (dateValue) {
          dateValue.textContent = filled === "yes" ? "ДД.MM.ГГГГ" : "";
        }
      }
      if (dateState) dateState.addEventListener("change", updateDateDemo);
      if (dateFilled) dateFilled.addEventListener("change", updateDateDemo);
      if (dateHelper) dateHelper.addEventListener("change", updateDateDemo);
      if (dateSize) dateSize.addEventListener("change", updateDateDemo);
      updateDateDemo();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var iconSwapperDemo = document.getElementById("icon-swapper-demo");
      var iconSwapperWrap = document.getElementById("icon-swapper-icon-wrap");
      var iconSwapperSize = document.getElementById("icon-swapper-size");
      var sizeMap = { "32": 32, "24": 24, "20": 20, "16": 16 };

      function updateIconSwapper(animate) {
        if (!iconSwapperDemo || !iconSwapperWrap) return;
        var size = (iconSwapperSize && iconSwapperSize.value) || "32";
        var px = sizeMap[size] || 32;

        iconSwapperDemo.className = "icon-swapper-demo";
        iconSwapperWrap.className = "icon-swapper-icon-wrap";
        iconSwapperWrap.style.width = px + "px";
        iconSwapperWrap.style.height = px + "px";

        if (animate) {
          iconSwapperWrap.classList.add("icon-swapper-icon-wrap--animating");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              iconSwapperWrap.classList.remove("icon-swapper-icon-wrap--animating");
            });
          });
        }
      }

      if (iconSwapperSize) iconSwapperSize.addEventListener("change", function () { updateIconSwapper(true); });
      document.addEventListener("storybook-theme-change", function () { updateIconSwapper(false); });
      updateIconSwapper(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var selectDemo = document.getElementById("select-demo");
      var selectLabelInput = document.getElementById("select-label-text");
      var selectValueInput = document.getElementById("select-value-text");
      var selectLabel = document.getElementById("select-demo-label");
      var selectValue = document.getElementById("select-demo-value");
      var selectFilled = document.getElementById("select-filled");
      var selectState = document.getElementById("select-state");
      var selectHelper = document.getElementById("select-helper");
      var selectSize = document.getElementById("select-size");
      var selectHelperText = document.getElementById("select-demo-helper");

      function updateSelectDemo(animate) {
        if (!selectDemo) return;
        var state = (selectState && selectState.value) || "default";
        var filled = (selectFilled && selectFilled.value) || "no";
        var helper = (selectHelper && selectHelper.value) || "no";
        var size = (selectSize && selectSize.value) || "m";
        var label = (selectLabelInput && selectLabelInput.value.trim()) || "label";
        var value = (selectValueInput && selectValueInput.value.trim()) || "content";
        var hasHelper = helper === "yes";
        var isFilled = filled === "yes";
        var isFocused = state === "focused";
        var isDanger = state === "danger";
        var isDisabled = state === "disabled";

        selectDemo.className = "select-demo";
        selectDemo.classList.add("select-demo--size-" + size);
        if (hasHelper) selectDemo.classList.add("select-demo--has-helper");
        if (isFilled) selectDemo.classList.add("select-demo--filled");
        if (isFocused) selectDemo.classList.add("select-demo--focused");
        if (isDanger) selectDemo.classList.add("select-demo--danger");
        if (isDisabled) selectDemo.classList.add("select-demo--disabled");

        if (!isFilled && isDanger) {
          selectDemo.style.setProperty("--select-label-color", "#ABABAB");
          selectDemo.style.setProperty("--select-value-color", "#FF4D3A");
        } else {
          selectDemo.style.removeProperty("--select-label-color");
          selectDemo.style.removeProperty("--select-value-color");
        }

        if (selectLabel) selectLabel.textContent = label;
        if (selectValue) selectValue.textContent = isFilled ? value : "";
        if (selectHelperText) selectHelperText.textContent = hasHelper ? "helper text" : "";

        if (animate) {
          selectDemo.classList.add("select-demo--animating");
          setTimeout(function () {
            if (selectDemo) selectDemo.classList.remove("select-demo--animating");
          }, 160);
        }
      }

      if (selectLabelInput) selectLabelInput.addEventListener("input", function () { updateSelectDemo(false); });
      if (selectValueInput) selectValueInput.addEventListener("input", function () { updateSelectDemo(false); });
      if (selectFilled) selectFilled.addEventListener("change", function () { updateSelectDemo(true); });
      if (selectState) selectState.addEventListener("change", function () { updateSelectDemo(true); });
      if (selectHelper) selectHelper.addEventListener("change", function () { updateSelectDemo(true); });
      if (selectSize) selectSize.addEventListener("change", function () { updateSelectDemo(true); });
      document.addEventListener("storybook-theme-change", function () { updateSelectDemo(false); });
      updateSelectDemo(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var skeletonAnimated = document.getElementById("skeleton-animated");
      var skeletonDoc = document.querySelector("#section-skeleton .skeleton-doc");
      var skeletonCard = document.getElementById("skeleton-loading-card");
      var skeletonPlaceholder = document.getElementById("skeleton-placeholder");
      var skeletonContent = document.getElementById("skeleton-content");
      var skeletonReloadBtn = document.getElementById("skeleton-reload-btn");
      var loadingTimer = null;

      function applySkeletonControls(animate) {
        if (!skeletonDoc) return;
        var animated = ((skeletonAnimated && skeletonAnimated.value) || "yes") === "yes";
        skeletonDoc.classList.toggle("skeleton-doc--animated", animated);

        if (animate && skeletonDoc) {
          skeletonDoc.style.transform = "translateY(2px)";
          skeletonDoc.style.opacity = "0.7";
          setTimeout(function () {
            if (!skeletonDoc) return;
            skeletonDoc.style.transform = "";
            skeletonDoc.style.opacity = "";
          }, 160);
        }
      }

      function runSkeletonLoading() {
        if (!skeletonPlaceholder || !skeletonContent) return;
        if (loadingTimer) clearTimeout(loadingTimer);
        skeletonPlaceholder.style.display = "flex";
        skeletonContent.classList.remove("skeleton-content--shown");
        loadingTimer = setTimeout(function () {
          skeletonPlaceholder.style.display = "none";
          skeletonContent.classList.add("skeleton-content--shown");
        }, 2000);
      }

      if (skeletonAnimated) skeletonAnimated.addEventListener("change", function () { applySkeletonControls(true); });
      if (skeletonReloadBtn) skeletonReloadBtn.addEventListener("click", runSkeletonLoading);
      document.addEventListener("storybook-theme-change", function () { applySkeletonControls(false); });

      applySkeletonControls(false);
      runSkeletonLoading();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var tagDemo = document.getElementById("tag-demo");
      var tagLabelInput = document.getElementById("tag-label-input");
      var tagLabel = document.getElementById("tag-demo-label");
      var tagColor = document.getElementById("tag-color");
      var tagIcon = document.getElementById("tag-icon");
      var tagFilter = document.getElementById("tag-filter");
      var tagLeadingIcon = document.getElementById("tag-leading-icon");
      var tagCloseBtn = document.getElementById("tag-close-btn");

      function updateTagDemo(animate) {
        if (!tagDemo) return;
        var color = (tagColor && tagColor.value) || "gray";
        var icon = ((tagIcon && tagIcon.value) || "yes") === "yes";
        var filter = ((tagFilter && tagFilter.value) || "no") === "yes";
        var label = (tagLabelInput && tagLabelInput.value.trim()) || "Label";

        if (filter) {
          color = "gray";
          icon = false;
          if (tagColor) tagColor.value = "gray";
          if (tagIcon) {
            tagIcon.value = "no";
            tagIcon.disabled = true;
          }
        } else if (tagIcon) {
          tagIcon.disabled = false;
        }

        tagDemo.className = "tag-demo";
        tagDemo.classList.add("tag-demo--" + color);
        tagDemo.classList.toggle("tag-demo--filter", filter);

        if (tagLabel) tagLabel.textContent = label;
        if (tagLeadingIcon) tagLeadingIcon.style.display = icon && !filter ? "block" : "none";
        if (tagCloseBtn) tagCloseBtn.style.display = filter ? "inline-flex" : "none";

        if (animate) {
          tagDemo.classList.add("tag-demo--animating");
          setTimeout(function () {
            if (tagDemo) tagDemo.classList.remove("tag-demo--animating");
          }, 160);
        }
      }

      if (tagLabelInput) tagLabelInput.addEventListener("input", function () { updateTagDemo(false); });
      if (tagColor) tagColor.addEventListener("change", function () { updateTagDemo(true); });
      if (tagIcon) tagIcon.addEventListener("change", function () { updateTagDemo(true); });
      if (tagFilter) tagFilter.addEventListener("change", function () { updateTagDemo(true); });
      if (tagCloseBtn) tagCloseBtn.addEventListener("click", function () {
        if (tagFilter) tagFilter.value = "no";
        updateTagDemo(true);
      });
      document.addEventListener("storybook-theme-change", function () { updateTagDemo(false); });
      updateTagDemo(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var tabsType = document.getElementById("tabs-type");
      var tabsIcon = document.getElementById("tabs-icon");
      var tabsCounter = document.getElementById("tabs-counter");
      var tabsCount = document.getElementById("tabs-count");
      var tabsActive = document.getElementById("tabs-active");
      var tabsDemo = document.getElementById("tabs-demo");

      function getAcornIcon() {
        return '<svg class="tabs-demo-item-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
          '<path d="M27 14V16C27 22.625 16 27 16 30C16 27 5 22.625 5 16V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 7H22C23.5913 7 25.1174 7.63214 26.2426 8.75736C27.3679 9.88258 28 11.4087 28 13C28 13.2652 27.8946 13.5196 27.7071 13.7071C27.5196 13.8946 27.2652 14 27 14H5C4.73478 14 4.48043 13.8946 4.29289 13.7071C4.10536 13.5196 4 13.2652 4 13C4 11.4087 4.63214 9.88258 5.75736 8.75736C6.88258 7.63214 8.4087 7 10 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M16 7V6C16 4.93913 16.4214 3.92172 17.1716 3.17157C17.9217 2.42143 18.9391 2 20 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
      }

      function syncTabsActiveOptions() {
        if (!tabsActive || !tabsCount) return;
        var count = parseInt(tabsCount.value || "2", 10);
        if (Number.isNaN(count) || count < 2) count = 2;
        var current = parseInt(tabsActive.value || "1", 10);
        if (Number.isNaN(current) || current < 1) current = 1;
        tabsActive.innerHTML = "";
        for (var i = 1; i <= count; i += 1) {
          var opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = String(i);
          tabsActive.appendChild(opt);
        }
        if (current > count) current = count;
        tabsActive.value = String(current);
      }

      function renderTabs(animate) {
        if (!tabsDemo || !tabsType || !tabsIcon || !tabsCounter || !tabsCount || !tabsActive) return;
        var type = tabsType.value || "primary";
        var hasIcon = tabsIcon.value === "yes";
        var hasCounter = tabsCounter.value === "yes";
        var count = parseInt(tabsCount.value || "2", 10);
        var activeIndex = parseInt(tabsActive.value || "1", 10);
        if (Number.isNaN(count) || count < 2) count = 2;
        if (Number.isNaN(activeIndex) || activeIndex < 1) activeIndex = 1;
        if (activeIndex > count) activeIndex = count;

        tabsDemo.className = "tabs-demo tabs-demo--" + type;
        tabsDemo.innerHTML = "";

        for (var i = 1; i <= count; i += 1) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tabs-demo-item" + (i === activeIndex ? " tabs-demo-item--active" : "");
          btn.setAttribute("role", "tab");
          btn.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
          btn.dataset.index = String(i);

          var html = "";
          if (hasIcon) html += getAcornIcon();
          html += '<span class="tabs-demo-item-label">Label</span>';
          if (hasCounter) html += '<span class="tabs-demo-item-counter">2</span>';
          btn.innerHTML = html;

          if (animate && i === activeIndex) btn.classList.add("tabs-demo-item--animating");
          tabsDemo.appendChild(btn);
        }
      }

      if (tabsDemo) {
        tabsDemo.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var tab = target.closest(".tabs-demo-item");
          if (!tab || !tabsActive) return;
          tabsActive.value = tab.dataset.index || "1";
          renderTabs(true);
        });
      }

      if (tabsType) tabsType.addEventListener("change", function () { renderTabs(true); });
      if (tabsIcon) tabsIcon.addEventListener("change", function () { renderTabs(true); });
      if (tabsCounter) tabsCounter.addEventListener("change", function () { renderTabs(true); });
      if (tabsCount) {
        tabsCount.addEventListener("change", function () {
          syncTabsActiveOptions();
          renderTabs(true);
        });
      }
      if (tabsActive) tabsActive.addEventListener("change", function () { renderTabs(true); });
      document.addEventListener("storybook-theme-change", function () { renderTabs(false); });

      syncTabsActiveOptions();
      renderTabs(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var tabbarTabsCount = document.getElementById("tabbar-tabs-count");
      var tabbarSeparateSearch = document.getElementById("tabbar-separate-search");
      var tabbarActiveTab = document.getElementById("tabbar-active-tab");
      var tabbarWrap = document.getElementById("tabbar-liquid-wrap");
      var tabbar = document.getElementById("tabbar-liquid");
      var tabbarSearch = document.getElementById("tabbar-liquid-search");
      var tabbarActiveIndex = 0;

      function acornIcon() {
        return '<svg class="tabbar-liquid-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
          '<path d="M27 14V16C27 22.625 16 27 16 30C16 27 5 22.625 5 16V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 7H22C23.5913 7 25.1174 7.63214 26.2426 8.75736C27.3679 9.88258 28 11.4087 28 13C28 13.2652 27.8946 13.5196 27.7071 13.7071C27.5196 13.8946 27.2652 14 27 14H5C4.73478 14 4.48043 13.8946 4.29289 13.7071C4.10536 13.5196 4 13.2652 4 13C4 11.4087 4.63214 9.88258 5.75736 8.75736C6.88258 7.63214 8.4087 7 10 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M16 7V6C16 4.93913 16.4214 3.92172 17.1716 3.17157C17.9217 2.42143 18.9391 2 20 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
      }

      function getTabbarCount() {
        if (!tabbarTabsCount) return 2;
        var count = parseInt(tabbarTabsCount.value || "5", 10);
        if (Number.isNaN(count) || count < 2) count = 2;
        return count;
      }

      function syncTabbarActiveOptions() {
        if (!tabbarActiveTab) return;
        var count = getTabbarCount();
        tabbarActiveTab.innerHTML = "";
        for (var i = 1; i <= count; i += 1) {
          var opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = String(i);
          tabbarActiveTab.appendChild(opt);
        }
        if (tabbarActiveIndex > count - 1) tabbarActiveIndex = count - 1;
        if (tabbarActiveIndex < 0) tabbarActiveIndex = 0;
        tabbarActiveTab.value = String(tabbarActiveIndex + 1);
      }

      function syncTabbarStateFromControls() {
        if (!tabbarActiveTab) return;
        var count = getTabbarCount();
        var selected = parseInt(tabbarActiveTab.value || "1", 10);
        if (Number.isNaN(selected) || selected < 1) selected = 1;
        if (selected > count) selected = count;
        tabbarActiveIndex = selected - 1;
      }

      function renderTabbar(animate) {
        if (!tabbar || !tabbarWrap || !tabbarTabsCount || !tabbarSeparateSearch || !tabbarActiveTab || !tabbarSearch) return;
        var count = getTabbarCount();
        var separateSearch = tabbarSeparateSearch.value === "yes";
        if (tabbarActiveIndex > count - 1) tabbarActiveIndex = count - 1;
        if (tabbarActiveIndex < 0) tabbarActiveIndex = 0;
        var active = tabbarActiveIndex + 1;

        var widthMapNoSearch = { 2: "194px", 3: "286px", 4: "352px", 5: "352px" };
        var widthMapSearch = { 2: "210px", 3: "286px", 4: "334px", 5: "352px" };
        var tabbarWidth = separateSearch ? (widthMapSearch[count] || "352px") : (widthMapNoSearch[count] || "352px");
        var tabItemWidth = "102px";
        if (separateSearch && count === 2) tabItemWidth = "110px";
        if (count >= 4) tabItemWidth = "auto";

        tabbar.className = "tabbar-liquid";
        tabbar.classList.toggle("tabbar-liquid--fill", count >= 4);
        tabbar.classList.toggle("tabbar-liquid--hug", count < 4);
        tabbar.style.setProperty("--tabbar-count", String(count));
        tabbar.style.setProperty("--tab-item-width", tabItemWidth);
        tabbar.style.setProperty("--tabbar-height", "62px");
        tabbar.style.width = tabbarWidth;
        tabbar.style.padding = "0 5px";
        tabbarSearch.style.display = separateSearch ? "inline-flex" : "none";
        tabbarWrap.style.justifyContent = "center";
        tabbarActiveTab.value = String(active);

        tabbar.innerHTML = "";
        var start = 1;
        var end = count;
        for (var i = start; i <= end; i += 1) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tabbar-liquid-item" + (i === active ? " tabbar-liquid-item--active" : "");
          btn.setAttribute("role", "tab");
          btn.setAttribute("aria-selected", i === active ? "true" : "false");
          btn.dataset.index = String(i);
          btn.innerHTML = acornIcon() + '<span class="tabbar-liquid-label">Label</span>';
          tabbar.appendChild(btn);
        }

        if (animate) {
          tabbarWrap.classList.add("tabbar-liquid-wrap--animating");
          setTimeout(function () {
            if (tabbarWrap) tabbarWrap.classList.remove("tabbar-liquid-wrap--animating");
          }, 170);
        }
      }

      if (tabbar) {
        tabbar.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element) || !tabbarActiveTab) return;
          var item = target.closest(".tabbar-liquid-item");
          if (!item) return;
          var next = parseInt(item.dataset.index || "1", 10);
          if (!Number.isNaN(next) && next > 0) tabbarActiveIndex = next - 1;
          tabbarActiveTab.value = String(tabbarActiveIndex + 1);
          renderTabbar(true);
        });
      }

      if (tabbarTabsCount) tabbarTabsCount.addEventListener("change", function () { syncTabbarActiveOptions(); renderTabbar(true); });
      if (tabbarSeparateSearch) tabbarSeparateSearch.addEventListener("change", function () { renderTabbar(true); });
      if (tabbarActiveTab) tabbarActiveTab.addEventListener("change", function () { syncTabbarStateFromControls(); renderTabbar(true); });
      document.addEventListener("storybook-theme-change", function () { renderTabbar(false); });

      syncTabbarStateFromControls();
      syncTabbarActiveOptions();
      renderTabbar(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var toggleState = document.getElementById("toggle-ios26-state");
      var toggleAx = document.getElementById("toggle-ios26-ax");
      var toggle = document.getElementById("toggle-ios26");
      var toggleAxLine = document.getElementById("toggle-ios26-ax-line");
      var toggleOffGlyph = document.getElementById("toggle-ios26-off-glyph");

      function renderToggle(animate) {
        if (!toggle || !toggleState || !toggleAx || !toggleAxLine || !toggleOffGlyph) return;
        var isOn = toggleState.value === "on";
        var showAx = toggleAx.value === "yes";

        toggle.className = "toggle-ios26 " + (isOn ? "toggle-ios26--on" : "toggle-ios26--off");
        toggle.setAttribute("aria-checked", isOn ? "true" : "false");
        toggleAxLine.style.display = showAx ? "block" : "none";
        toggleOffGlyph.style.display = isOn ? "none" : "block";

        if (animate) {
          toggle.classList.add("toggle-ios26--animating");
          setTimeout(function () {
            if (toggle) toggle.classList.remove("toggle-ios26--animating");
          }, 160);
        }
      }

      if (toggleState) toggleState.addEventListener("change", function () { renderToggle(true); });
      if (toggleAx) toggleAx.addEventListener("change", function () { renderToggle(true); });
      if (toggle) {
        toggle.addEventListener("click", function () {
          if (!toggleState) return;
          toggleState.value = toggleState.value === "on" ? "off" : "on";
          renderToggle(true);
        });
      }
      document.addEventListener("storybook-theme-change", function () { renderToggle(false); });
      renderToggle(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var bubbleMy = document.getElementById("bubble-chat-my");
      var bubblePosition = document.getElementById("bubble-chat-position");
      var bubbleReply = document.getElementById("bubble-chat-reply");
      var bubbleImage = document.getElementById("bubble-chat-image");
      var bubbleRow = document.getElementById("bubble-chat-row");
      var bubbleMainImage = document.getElementById("bubble-chat-main-image");
      var bubbleReplyBlock = document.getElementById("bubble-chat-reply-block");
      var bubbleReplyThumb = document.getElementById("bubble-chat-reply-thumb");
      var bubbleLeftTime = document.getElementById("bubble-chat-time-left");
      var bubbleRightTime = document.getElementById("bubble-chat-time-right");
      var bubbleBubble = document.getElementById("bubble-chat-bubble");

      function renderBubbleChat(animate) {
        if (!bubbleMy || !bubblePosition || !bubbleReply || !bubbleImage || !bubbleRow || !bubbleMainImage || !bubbleReplyBlock || !bubbleReplyThumb || !bubbleLeftTime || !bubbleRightTime || !bubbleBubble) return;
        var isMine = bubbleMy.value === "yes";
        var position = bubblePosition.value || "only-one";
        var reply = bubbleReply.value || "no";
        var hasImage = bubbleImage.value === "yes";
        var hasReply = reply !== "no";

        bubbleRow.className = "bubble-chat-row";
        if (isMine) bubbleRow.classList.add("bubble-chat-row--mine");
        if (animate) bubbleRow.classList.add("bubble-chat-row--animating");

        bubbleBubble.className = "bubble-chat-bubble bubble-chat-bubble--" + position;
        bubbleBubble.classList.toggle("bubble-chat-bubble--with-image", hasImage);
        bubbleBubble.classList.toggle("bubble-chat-bubble--reply-image", hasReply && reply === "image");

        bubbleMainImage.style.display = hasImage ? "block" : "none";
        bubbleReplyBlock.style.display = hasReply ? "flex" : "none";
        bubbleReplyThumb.style.display = hasReply && reply === "image" ? "block" : "none";

        bubbleLeftTime.style.display = isMine ? "inline-flex" : "none";
        bubbleRightTime.style.display = isMine ? "none" : "inline-flex";

        if (animate) {
          setTimeout(function () {
            if (bubbleRow) bubbleRow.classList.remove("bubble-chat-row--animating");
          }, 160);
        }
      }

      if (bubbleMy) bubbleMy.addEventListener("change", function () { renderBubbleChat(true); });
      if (bubblePosition) bubblePosition.addEventListener("change", function () { renderBubbleChat(true); });
      if (bubbleReply) bubbleReply.addEventListener("change", function () { renderBubbleChat(true); });
      if (bubbleImage) bubbleImage.addEventListener("change", function () { renderBubbleChat(true); });
      document.addEventListener("storybook-theme-change", function () { renderBubbleChat(false); });
      renderBubbleChat(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var messageProperty = document.getElementById("message-input-property");
      var messageText = document.getElementById("message-input-text");
      var messageToolbar = document.getElementById("message-input-toolbar");
      var messageControl = document.getElementById("message-input-control");
      var messageReply = document.getElementById("message-input-reply");
      var messageSend = document.getElementById("message-input-send");
      var messageCursor = document.getElementById("message-input-cursor");
      var messageLiveEditing = false;

      function resizeMessageControl() {
        if (!messageControl) return;
        messageControl.style.height = "auto";
        var rows = Math.min(messageControl.scrollHeight, 68);
        messageControl.style.height = rows + "px";
      }

      function renderMessageInput(animate) {
        if (!messageProperty || !messageText || !messageToolbar || !messageControl || !messageReply || !messageSend || !messageCursor) return;
        var property = messageProperty.value || "Default";
        var panelText = (messageText.value || "").replace(/\r/g, "");
        var liveText = (messageControl.value || "").replace(/\r/g, "");
        var text = messageLiveEditing ? liveText : panelText;
        if (property === "Default" && !messageLiveEditing) text = "";
        var autoMultiline = text.indexOf("\n") !== -1 || text.length > 34;
        var visualProperty = property;

        if (property === "Default" && messageLiveEditing && text.length > 0) {
          visualProperty = autoMultiline ? "more input" : "input";
        } else if (property === "input" && autoMultiline) {
          visualProperty = "more input";
        }

        messageToolbar.className = "message-input-toolbar";
        messageToolbar.classList.add("message-input-toolbar--" + visualProperty.replace(/\s+/g, "-").toLowerCase());

        var isDefault = visualProperty === "Default";
        var isInput = visualProperty === "input";
        var isMore = visualProperty === "more input";
        var isReply = visualProperty === "reply";
        var isMultiline = isMore || isReply;

        messageToolbar.classList.toggle("message-input-toolbar--multiline", isMultiline);
        messageReply.style.display = isReply ? "inline-flex" : "none";
        messageSend.style.display = isDefault ? "none" : "inline-flex";
        messageSend.style.width = isInput ? "32px" : "32px";
        messageSend.style.height = isInput ? "32px" : "22px";
        messageSend.style.padding = isInput ? "8px" : "0 8px";
        messageCursor.style.display = "none";

        messageControl.rows = isMultiline ? 2 : 1;
        messageControl.value = text;
        messageControl.placeholder = isDefault && !text ? "Сообщение" : "";
        messageControl.readOnly = false;
        messageControl.style.whiteSpace = "pre-wrap";
        messageControl.style.overflowX = "hidden";
        messageControl.style.overflowY = "hidden";

        resizeMessageControl();

        if (animate) {
          messageToolbar.classList.add("message-input-toolbar--animating");
          setTimeout(function () {
            if (messageToolbar) messageToolbar.classList.remove("message-input-toolbar--animating");
          }, 160);
        }
      }

      if (messageProperty) messageProperty.addEventListener("change", function () {
        messageLiveEditing = false;
        if (messageProperty.value === "Default" && messageControl) messageControl.value = "";
        renderMessageInput(true);
      });
      if (messageText) messageText.addEventListener("input", function () {
        if (!messageLiveEditing) renderMessageInput(false);
      });
      if (messageControl) messageControl.addEventListener("input", function () {
        messageLiveEditing = true;
        messageText.value = messageControl.value;
        renderMessageInput(false);
      });
      if (messageSend) messageSend.addEventListener("click", function () {
        if (!messageControl) return;
        messageControl.focus();
      });
      document.addEventListener("storybook-theme-change", function () { renderMessageInput(false); });
      renderMessageInput(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var phoneState = document.getElementById("phone-state");
      var phoneFilled = document.getElementById("phone-filled");
      var phoneCountry = document.getElementById("phone-country");
      var phoneDemo = document.getElementById("phone-input-demo");
      var phoneInput = document.getElementById("phone-number-input");
      var phoneFlag = document.getElementById("phone-flag");
      var phonePlus = document.getElementById("phone-plus");
      var phonePrefix = document.getElementById("phone-prefix");
      var phoneCaret = document.getElementById("phone-caret");

      var countries = {
        ru: { flag: "🇷🇺", code: "7", mask: "XXX XXX-XX-XX", placeholder: "--- --- -- --" },
        us: { flag: "🇺🇸", code: "1", mask: "XXX XXX-XXXX", placeholder: "--- --- ----" },
        gb: { flag: "🇬🇧", code: "44", mask: "XXXX XXXXXX", placeholder: "---- ------" },
        kz: { flag: "🇰🇿", code: "7", mask: "XXX XXX-XX-XX", placeholder: "--- --- -- --" }
      };
      var sampleDigits = "9993233232";

      function pickCountryByDial(digits) {
        if (!digits) return null;
        if (digits.indexOf("44") === 0) return "gb";
        if (digits.indexOf("1") === 0) return "us";
        if (digits.indexOf("7") === 0) return "ru";
        return null;
      }

      function formatMaskPartial(digits, mask) {
        var out = "";
        var di = 0;
        for (var i = 0; i < mask.length; i += 1) {
          var ch = mask.charAt(i);
          if (ch === "X") {
            if (di < digits.length) {
              out += digits.charAt(di);
              di += 1;
            } else {
              break;
            }
          } else {
            if (di > 0 && di < digits.length) out += ch;
          }
        }
        return out;
      }

      function splitDialFromInput(digits, currentCountryKey) {
        var key = countries[currentCountryKey] ? currentCountryKey : "ru";
        var detected = pickCountryByDial(digits);
        if (detected) key = detected;
        var code = countries[key].code;
        var national = digits;
        if (national.indexOf(code) === 0) national = national.slice(code.length);
        return { countryKey: key, national: national };
      }

      function updatePhoneInputUI(syncMask) {
        if (!phoneDemo || !phoneInput || !phoneCountry || !phoneFlag || !phonePrefix || !phonePlus) return;
        var state = phoneState ? phoneState.value : "default";
        var countryKey = countries[phoneCountry.value] ? phoneCountry.value : "ru";
        var rawDigits = (phoneInput.value || "").replace(/\D/g, "");
        var split = splitDialFromInput(rawDigits, countryKey);
        var nationalRaw = split.national;

        if (syncMask && split.countryKey !== countryKey) {
          countryKey = split.countryKey;
          phoneCountry.value = countryKey;
        }

        if (syncMask && (state === "default" || state === "select-focused") && rawDigits.length > 0) {
          state = "input-focused";
          if (phoneState) phoneState.value = "input-focused";
        }

        if (syncMask && phoneFilled) {
          if (state === "input-focused" || state === "invalid" || rawDigits.length > 0) phoneFilled.value = "yes";
          if ((state === "default" || state === "select-focused") && rawDigits.length === 0) phoneFilled.value = "no";
          if (state === "disabled" || state === "frame-3") phoneFilled.value = "no";
        }

        var filled = phoneFilled ? phoneFilled.value === "yes" : false;
        var country = countries[countryKey];
        var maxDigits = (country.mask.match(/X/g) || []).length;
        nationalRaw = nationalRaw.slice(0, maxDigits);
        var hasDialOrInput = rawDigits.length > 0;

        phoneFlag.textContent = country.flag;
        phonePrefix.textContent = country.code;

        phoneDemo.className = "phone-input-demo";
        if (state === "input-focused") phoneDemo.classList.add("phone-input-demo--input-focused");
        if (state === "invalid") phoneDemo.classList.add("phone-input-demo--invalid");
        if (state === "disabled" || state === "frame-3") phoneDemo.classList.add("phone-input-demo--disabled");
        if (filled) phoneDemo.classList.add("phone-input-demo--filled"); else phoneDemo.classList.add("phone-input-demo--unfilled");
        if (state === "default" && filled) phoneDemo.classList.add("phone-input-demo--show-action");

        var hideCountryBlock = !hasDialOrInput || state === "frame-3" || state === "disabled";
        phoneFlag.classList.toggle("phone-input-hidden", hideCountryBlock);
        phonePlus.classList.toggle("phone-input-hidden", hideCountryBlock);
        phonePrefix.classList.toggle("phone-input-hidden", hideCountryBlock);

        if (state === "frame-3") {
          phoneInput.placeholder = "Телефон";
          phoneInput.value = "";
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        } else if (state === "select-focused") {
          phoneInput.placeholder = rawDigits.length === 0 ? "Телефон" : country.placeholder;
          phoneInput.value = rawDigits.length === 0 ? "" : formatMaskPartial(nationalRaw, country.mask);
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        } else if (state === "disabled") {
          phoneInput.placeholder = "";
          phoneInput.value = formatMaskPartial(sampleDigits.slice(0, maxDigits), country.mask);
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        } else if (state === "input-focused") {
          var focusedMasked = formatMaskPartial(nationalRaw, country.mask);
          phoneInput.value = focusedMasked;
          phoneInput.placeholder = hasDialOrInput ? country.placeholder : "Телефон";
          if (phoneCaret) phoneCaret.classList.toggle("phone-input-hidden", hasDialOrInput);
        } else if (state === "default" && filled) {
          var defaultFilledMasked = formatMaskPartial(nationalRaw || sampleDigits.slice(0, maxDigits), country.mask);
          phoneInput.value = defaultFilledMasked;
          phoneInput.placeholder = "";
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        } else if (state === "invalid") {
          var invalidMasked = formatMaskPartial(nationalRaw || sampleDigits.slice(0, maxDigits), country.mask);
          phoneInput.value = invalidMasked;
          phoneInput.placeholder = "";
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        } else {
          phoneInput.value = "";
          phoneInput.placeholder = "Телефон";
          if (phoneCaret) phoneCaret.classList.add("phone-input-hidden");
        }

        var disabled = state === "disabled" || state === "frame-3";
        phoneInput.disabled = disabled;
      }

      if (phoneState) phoneState.addEventListener("change", function () { updatePhoneInputUI(true); });
      if (phoneFilled) phoneFilled.addEventListener("change", function () { updatePhoneInputUI(true); });
      if (phoneCountry) phoneCountry.addEventListener("change", function () { updatePhoneInputUI(true); });
      if (phoneInput) {
        phoneInput.addEventListener("input", function () { updatePhoneInputUI(true); });
        phoneInput.addEventListener("focus", function () {
          if (phoneState && (phoneState.value === "default" || phoneState.value === "select-focused")) {
            phoneState.value = "input-focused";
          }
          updatePhoneInputUI(false);
        });
        phoneInput.addEventListener("blur", function () {
          var hasDigits = (phoneInput.value || "").replace(/\D/g, "").length > 0;
          if (phoneState && phoneState.value === "input-focused" && !hasDigits) {
            phoneState.value = "default";
          }
          updatePhoneInputUI(false);
        });
      }
      document.addEventListener("storybook-theme-change", function () { updatePhoneInputUI(false); });
      updatePhoneInputUI(true);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var pincodeSize = document.getElementById("pincode-size");
      var pincodeFilled = document.getElementById("pincode-filled");
      var pincodeState = document.getElementById("pincode-state");
      var pincodeDemo = document.getElementById("pincode-demo");
      var pincodeHiddenInput = document.getElementById("pincode-hidden-input");
      var demoDigits = "994442";

      function renderPincodeSlots(animate) {
        if (!pincodeDemo || !pincodeHiddenInput) return;

        var size = (pincodeSize && pincodeSize.value) || "large";
        var filled = pincodeFilled && pincodeFilled.value === "yes";
        var state = (pincodeState && pincodeState.value) || "default";
        var slots = size === "large" ? 4 : 6;
        var rawValue = (pincodeHiddenInput.value || "").replace(/\D/g, "").slice(0, slots);

        if (!filled && state !== "focused") rawValue = "";
        if (filled && !rawValue) rawValue = demoDigits.slice(0, slots);

        pincodeHiddenInput.value = rawValue;

        pincodeDemo.className = "pincode-demo";
        pincodeDemo.classList.add("pincode-demo--size-" + size);
        if (state === "focused") pincodeDemo.classList.add("pincode-demo--focused");
        if (state === "danger") pincodeDemo.classList.add("pincode-demo--danger");
        if (animate) pincodeDemo.classList.add("pincode-demo--animating");

        pincodeDemo.querySelectorAll(".pincode-demo-slot").forEach(function (el) { el.remove(); });

        for (var i = 0; i < slots; i += 1) {
          var slot = document.createElement("div");
          slot.className = "pincode-demo-slot";
          var ch = document.createElement("span");

          if (state === "focused" && i === rawValue.length) {
            ch.className = "pincode-demo-char--caret";
            ch.textContent = "|";
          } else if (i < rawValue.length) {
            ch.textContent = rawValue.charAt(i);
          } else {
            ch.className = "pincode-demo-char--empty";
            ch.textContent = "•";
          }

          slot.appendChild(ch);
          pincodeDemo.appendChild(slot);
        }

        if (animate) {
          setTimeout(function () {
            if (pincodeDemo) pincodeDemo.classList.remove("pincode-demo--animating");
          }, 170);
        }
      }

      if (pincodeDemo && pincodeHiddenInput) {
        pincodeDemo.addEventListener("click", function () { pincodeHiddenInput.focus(); });
        pincodeDemo.addEventListener("focus", function () { pincodeHiddenInput.focus(); });
      }
      if (pincodeSize) pincodeSize.addEventListener("change", function () { renderPincodeSlots(true); });
      if (pincodeFilled) pincodeFilled.addEventListener("change", function () { renderPincodeSlots(true); });
      if (pincodeState) pincodeState.addEventListener("change", function () { renderPincodeSlots(true); });
      if (pincodeHiddenInput) {
        pincodeHiddenInput.addEventListener("input", function () {
          pincodeHiddenInput.value = (pincodeHiddenInput.value || "").replace(/\D/g, "");
          if (pincodeFilled && pincodeFilled.value !== "yes") pincodeFilled.value = "yes";
          if (pincodeState && pincodeState.value === "default") pincodeState.value = "focused";
          renderPincodeSlots(false);
        });
        pincodeHiddenInput.addEventListener("focus", function () {
          if (pincodeState && pincodeState.value === "default" && pincodeFilled && pincodeFilled.value === "no") {
            pincodeState.value = "focused";
          }
          renderPincodeSlots(false);
        });
      }
      document.addEventListener("storybook-theme-change", function () { renderPincodeSlots(false); });
      renderPincodeSlots(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var progressType = document.getElementById("progressbar-type");
      var progressStyle = document.getElementById("progressbar-style");
      var progressPercent = document.getElementById("progressbar-percent");
      var progressSegments = document.getElementById("progressbar-segments");
      var progressStep = document.getElementById("progressbar-step");
      var progressDemo = document.getElementById("progressbar-demo");
      var progressTrack = document.getElementById("progressbar-track");
      var progressFill = document.getElementById("progressbar-fill");
      var progressSegmented = document.getElementById("progressbar-segmented");
      var progressPercentRow = document.getElementById("progressbar-percent-row");
      var progressSegmentsRow = document.getElementById("progressbar-segments-row");
      var progressStepRow = document.getElementById("progressbar-step-row");

      var styleColors = {
        accent: "#0DC267",
        special: "#883BE9",
        warning: "#F7A300",
        negative: "#FF4D3A"
      };

      function syncStepOptions() {
        if (!progressStep || !progressSegments) return;
        var segs = parseInt(progressSegments.value, 10) || 8;
        var current = parseInt(progressStep.value, 10) || 0;
        progressStep.innerHTML = "";
        for (var i = 0; i <= segs; i += 1) {
          var opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = String(i);
          progressStep.appendChild(opt);
        }
        progressStep.value = String(Math.min(current, segs));
      }

      function renderProgressbar(animate) {
        if (!progressType || !progressStyle || !progressDemo || !progressTrack || !progressFill || !progressSegmented || !progressPercentRow || !progressSegmentsRow || !progressStepRow) return;
        var type = progressType.value || "progress";
        if (progressStyle.value === "positive") progressStyle.value = "accent";
        var color = styleColors[progressStyle.value] || styleColors.accent;

        if (type === "segmented") {
          syncStepOptions();
        }

        progressDemo.style.setProperty("--progressbar-color", color);
        progressPercentRow.classList.toggle("progressbar-hidden", type !== "progress");
        progressSegmentsRow.classList.toggle("progressbar-hidden", type !== "segmented");
        progressStepRow.classList.toggle("progressbar-hidden", type !== "segmented");
        progressTrack.classList.toggle("progressbar-hidden", type !== "progress");
        progressSegmented.classList.toggle("progressbar-hidden", type !== "segmented");

        if (type === "progress") {
          var pct = parseInt((progressPercent && progressPercent.value) || "5", 10);
          if (isNaN(pct)) pct = 5;
          pct = Math.max(0, Math.min(100, pct));
          progressFill.style.width = pct + "%";
        } else {
          var segs = parseInt((progressSegments && progressSegments.value) || "8", 10);
          var step = parseInt((progressStep && progressStep.value) || "1", 10);
          if (isNaN(segs)) segs = 8;
          if (isNaN(step)) step = 1;
          step = Math.max(0, Math.min(segs, step));
          progressSegmented.innerHTML = "";
          for (var i = 0; i < segs; i += 1) {
            var part = document.createElement("div");
            part.className = "progressbar-segment" + (i < step ? " progressbar-segment--active" : "");
            progressSegmented.appendChild(part);
          }
        }

        if (animate) {
          progressDemo.classList.add("progressbar-demo--animating");
          setTimeout(function () {
            if (progressDemo) progressDemo.classList.remove("progressbar-demo--animating");
          }, 170);
        }
      }

      if (progressType) progressType.addEventListener("change", function () { renderProgressbar(true); });
      if (progressStyle) progressStyle.addEventListener("change", function () { renderProgressbar(true); });
      if (progressPercent) progressPercent.addEventListener("change", function () { renderProgressbar(true); });
      if (progressSegments) progressSegments.addEventListener("change", function () { syncStepOptions(); renderProgressbar(true); });
      if (progressStep) progressStep.addEventListener("change", function () { renderProgressbar(true); });
      document.addEventListener("storybook-theme-change", function () { renderProgressbar(false); });
      syncStepOptions();
      if (progressStep) progressStep.value = "1";
      renderProgressbar(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var loaderSize = document.getElementById("loader-size");
      var loaderSpinner = document.getElementById("loader-spinner");
      var sizeMap = { "32": 32, "24": 24, "20": 20, "16": 16, "8": 8 };

      function updateLoaderDemo() {
        if (!loaderSpinner) return;
        var size = (loaderSize && loaderSize.value) || "32";
        var px = sizeMap[size] || 32;
        loaderSpinner.style.setProperty("--loader-size", px + "px");
      }

      if (loaderSize) loaderSize.addEventListener("change", updateLoaderDemo);
      document.addEventListener("storybook-theme-change", updateLoaderDemo);
      updateLoaderDemo();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var toolbarTop = document.getElementById("toolbar-top");
      var toolbarStyle = document.getElementById("toolbar-style");
      var toolbarTitleInput = document.getElementById("toolbar-title-input");
      var toolbarSubtitleInput = document.getElementById("toolbar-subtitle-input");
      var toolbarLeading = document.getElementById("toolbar-leading");
      var toolbarTrailing = document.getElementById("toolbar-trailing");
      var toolbarTrailingMainBtn = document.getElementById("toolbar-trailing-main-btn");
      var toolbarTitleWrap = document.getElementById("toolbar-title-wrap");
      var toolbarTitleBlock = document.getElementById("toolbar-title-block");
      var toolbarTitleText = document.getElementById("toolbar-title-text");
      var toolbarSubtitleText = document.getElementById("toolbar-subtitle-text");
      var toolbarControlsRow = document.getElementById("toolbar-controls-row");

      function applyToolbarStyle(animate) {
        if (!toolbarTop) return;
        var style = (toolbarStyle && toolbarStyle.value) || "back";
        var title = (toolbarTitleInput && toolbarTitleInput.value.trim()) || "Title";
        var subtitle = (toolbarSubtitleInput && toolbarSubtitleInput.value.trim()) || "Subtitle";
        var isBack = style === "back";
        var isDefault = style === "default";
        var isTitle2Line = style === "title-2-line";
        var isTitle2LineLeft = style === "title-2-line-left";
        var isLargeTitle = style === "large-title";
        var isCompactLarge = style === "compact-large";

        if (animate) {
          toolbarTop.classList.add("toolbar-top--animating");
          setTimeout(function () { toolbarTop.classList.remove("toolbar-top--animating"); }, 180);
        }

        toolbarTop.className = "toolbar-top";
        toolbarTop.classList.add("toolbar-top--style-" + style);

        if (toolbarTitleText) toolbarTitleText.textContent = title;
        if (toolbarSubtitleText) toolbarSubtitleText.textContent = subtitle;

        if (toolbarLeading) toolbarLeading.classList.toggle("toolbar-hidden", isCompactLarge || isLargeTitle);
        if (toolbarTrailing) toolbarTrailing.classList.toggle("toolbar-hidden", isBack || isLargeTitle);
        if (toolbarTitleWrap) toolbarTitleWrap.classList.toggle("toolbar-hidden", isBack);
        if (toolbarControlsRow) toolbarControlsRow.classList.toggle("toolbar-hidden", !isLargeTitle);

        if (toolbarTitleBlock) {
          toolbarTitleBlock.classList.toggle("toolbar-title-block--large", isLargeTitle);
          toolbarTitleBlock.classList.toggle("toolbar-title-block--compact", isCompactLarge);
        }

        if (toolbarSubtitleText) {
          toolbarSubtitleText.classList.toggle("toolbar-hidden", isDefault || isBack || isCompactLarge);
        }

        if (toolbarTrailingMainBtn) {
          toolbarTrailingMainBtn.classList.toggle("toolbar-glass-btn--accent", isDefault || isCompactLarge);
        }

      }

      if (toolbarStyle) toolbarStyle.addEventListener("change", function () { applyToolbarStyle(true); });
      if (toolbarTitleInput) toolbarTitleInput.addEventListener("input", function () { applyToolbarStyle(false); });
      if (toolbarSubtitleInput) toolbarSubtitleInput.addEventListener("input", function () { applyToolbarStyle(false); });
      document.addEventListener("storybook-theme-change", function () { applyToolbarStyle(false); });
      applyToolbarStyle(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var sheetTopbar = document.getElementById("sheet-topbar");
      var sheetTopbarStyle = document.getElementById("sheet-topbar-style");
      var sheetTopbarTitleInput = document.getElementById("sheet-topbar-title-input");
      var sheetTopbarSubtitleInput = document.getElementById("sheet-topbar-subtitle-input");
      var sheetTopbarMain = document.getElementById("sheet-topbar-main");
      var sheetTopbarControls = document.getElementById("sheet-topbar-controls");
      var sheetTopbarLarge = document.getElementById("sheet-topbar-large");
      var sheetTopbarMainLeading = document.getElementById("sheet-topbar-main-leading");
      var sheetTopbarTitleBlock = document.getElementById("sheet-topbar-title-block");
      var sheetTopbarTitleText = document.getElementById("sheet-topbar-title-text");
      var sheetTopbarSubtitleText = document.getElementById("sheet-topbar-subtitle-text");
      var sheetTopbarLargeTitle = document.getElementById("sheet-topbar-large-title");
      var sheetTopbarLargeSubtitle = document.getElementById("sheet-topbar-large-subtitle");

      function applySheetTopbarStyle(animate) {
        if (!sheetTopbar) return;
        var style = (sheetTopbarStyle && sheetTopbarStyle.value) || "default";
        var title = (sheetTopbarTitleInput && sheetTopbarTitleInput.value.trim()) || "Title";
        var subtitle = (sheetTopbarSubtitleInput && sheetTopbarSubtitleInput.value.trim()) || "Subtitle";
        var isDefault = style === "default";
        var isTitle2Line = style === "title-2-line";
        var isTitle2LineLeft = style === "title-2-line-left";
        var isLargeTitle = style === "large-title";
        var isCompactLarge = style === "compact-large";

        if (animate) {
          sheetTopbar.classList.add("sheet-topbar--animating");
          setTimeout(function () { sheetTopbar.classList.remove("sheet-topbar--animating"); }, 180);
        }

        sheetTopbar.className = "sheet-topbar";
        sheetTopbar.classList.add("sheet-topbar--style-" + style);

        if (sheetTopbarTitleText) {
          sheetTopbarTitleText.textContent = title;
          sheetTopbarTitleText.style.fontSize = isCompactLarge ? "24px" : "16px";
          sheetTopbarTitleText.style.lineHeight = isCompactLarge ? "32px" : "22px";
        }
        if (sheetTopbarSubtitleText) sheetTopbarSubtitleText.textContent = subtitle;
        if (sheetTopbarLargeTitle) sheetTopbarLargeTitle.textContent = title;
        if (sheetTopbarLargeSubtitle) sheetTopbarLargeSubtitle.textContent = subtitle;

        if (sheetTopbarControls) sheetTopbarControls.classList.toggle("sheet-topbar-hidden", !isLargeTitle);
        if (sheetTopbarLarge) sheetTopbarLarge.classList.toggle("sheet-topbar-hidden", !isLargeTitle);
        if (sheetTopbarMain) sheetTopbarMain.classList.toggle("sheet-topbar-hidden", isLargeTitle);
        if (sheetTopbarMainLeading) sheetTopbarMainLeading.classList.toggle("sheet-topbar-hidden", isCompactLarge);

        if (sheetTopbarTitleBlock) {
          sheetTopbarTitleBlock.style.alignItems = (isTitle2LineLeft || isCompactLarge) ? "flex-start" : "center";
          sheetTopbarTitleBlock.style.textAlign = (isTitle2LineLeft || isCompactLarge) ? "left" : "center";
        }

        if (sheetTopbarSubtitleText) {
          sheetTopbarSubtitleText.classList.toggle("sheet-topbar-hidden", isDefault || isCompactLarge);
        }
      }

      if (sheetTopbarStyle) sheetTopbarStyle.addEventListener("change", function () { applySheetTopbarStyle(true); });
      if (sheetTopbarTitleInput) sheetTopbarTitleInput.addEventListener("input", function () { applySheetTopbarStyle(false); });
      if (sheetTopbarSubtitleInput) sheetTopbarSubtitleInput.addEventListener("input", function () { applySheetTopbarStyle(false); });
      document.addEventListener("storybook-theme-change", function () { applySheetTopbarStyle(false); });
      applySheetTopbarStyle(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      var segmentedMode = document.getElementById("segmented-liquid-mode");
      var segmentedSize = document.getElementById("segmented-liquid-size");
      var segmentedCount = document.getElementById("segmented-liquid-count");
      var segmentedStretched = document.getElementById("segmented-liquid-stretched");
      var segmentedDemo = document.getElementById("segmented-liquid-demo");
      var activeIndex = 0;
      var labelText = "Label";

      var fixedWidths = {
        icon: {
          large: { 2: 108, 3: 160, 4: 212, 5: 264 },
          medium: { 2: 92, 3: 136, 4: 180, 5: 224 },
          small: { 2: 92, 3: 136, 4: 180, 5: 224 }
        },
        label: {
          large: { 2: 162, 3: 237, 4: 312, 5: 387 },
          medium: { 2: 153, 3: 227, 4: 301, 5: 375 },
          small: { 2: 127, 3: 188, 4: 249, 5: 310 }
        }
      };

      var stretchedWidths = {
        icon: {
          large: { 2: 200, 3: 200, 4: 300, 5: 300 },
          medium: { 2: 200, 3: 200, 4: 300, 5: 300 },
          small: { 2: 200, 3: 200, 4: 300, 5: 300 }
        },
        label: {
          large: { 2: 300, 3: 300, 4: 400, 5: 450 },
          medium: { 2: 300, 3: 300, 4: 400, 5: 450 },
          small: { 2: 300, 3: 300, 4: 400, 5: 450 }
        }
      };

      function getAcornSvg() {
        return '<svg class="segmented-liquid-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
          '<path d="M27 14V16C27 22.625 16 27 16 30C16 27 5 22.625 5 16V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 7H22C23.5913 7 25.1174 7.63214 26.2426 8.75736C27.3679 9.88258 28 11.4087 28 13C28 13.2652 27.8946 13.5196 27.7071 13.7071C27.5196 13.8946 27.2652 14 27 14H5C4.73478 14 4.48043 13.8946 4.29289 13.7071C4.10536 13.5196 4 13.2652 4 13C4 11.4087 4.63214 9.88258 5.75736 8.75736C6.88258 7.63214 8.4087 7 10 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M16 7V6C16 4.93913 16.4214 3.92172 17.1716 3.17157C17.9217 2.42143 18.9391 2 20 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
      }

      function updateSegmentedLiquid(animate) {
        if (!segmentedDemo) return;
        var mode = (segmentedMode && segmentedMode.value) || "icon";
        var size = (segmentedSize && segmentedSize.value) || "large";
        var count = parseInt((segmentedCount && segmentedCount.value) || "2", 10);
        var stretched = ((segmentedStretched && segmentedStretched.value) || "false") === "true";

        if (activeIndex >= count) activeIndex = 0;
        if (activeIndex < 0) activeIndex = 0;

        segmentedDemo.className = "segmented-liquid segmented-liquid--" + mode + "-" + size;
        segmentedDemo.classList.toggle("segmented-liquid--stretched", stretched);

        var widthSource = stretched ? stretchedWidths : fixedWidths;
        var width = widthSource[mode] && widthSource[mode][size] && widthSource[mode][size][count];
        width = width || 200;
        segmentedDemo.style.width = width + "px";
        segmentedDemo.style.minWidth = width + "px";
        segmentedDemo.style.setProperty("--seg-width-stretched", width + "px");

        segmentedDemo.innerHTML = "";

        for (var i = 0; i < count; i += 1) {
          var segment = document.createElement("button");
          segment.type = "button";
          segment.className = "segmented-liquid-segment" + (i === activeIndex ? " segmented-liquid-segment--selected" : "");
          segment.setAttribute("role", "tab");
          segment.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
          segment.setAttribute("aria-label", "Segment " + (i + 1));
          segment.dataset.index = String(i);

          if (mode === "icon") {
            segment.innerHTML = getAcornSvg();
          } else {
            var label = document.createElement("span");
            label.className = "segmented-liquid-segment-label";
            label.textContent = labelText;
            segment.appendChild(label);
          }
          segmentedDemo.appendChild(segment);
        }

        if (animate) {
          segmentedDemo.classList.add("segmented-liquid--animating");
          setTimeout(function () {
            if (segmentedDemo) segmentedDemo.classList.remove("segmented-liquid--animating");
          }, 170);
        }
      }

      if (segmentedDemo) {
        segmentedDemo.addEventListener("click", function (event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var button = target.closest(".segmented-liquid-segment");
          if (!button) return;
          var nextIndex = parseInt(button.dataset.index || "0", 10);
          if (Number.isNaN(nextIndex)) return;
          activeIndex = nextIndex;
          updateSegmentedLiquid(true);
        });
      }

      if (segmentedMode) segmentedMode.addEventListener("change", function () { updateSegmentedLiquid(true); });
      if (segmentedSize) segmentedSize.addEventListener("change", function () { updateSegmentedLiquid(true); });
      if (segmentedCount) segmentedCount.addEventListener("change", function () { updateSegmentedLiquid(true); });
      if (segmentedStretched) segmentedStretched.addEventListener("change", function () { updateSegmentedLiquid(true); });
      document.addEventListener("storybook-theme-change", function () { updateSegmentedLiquid(false); });
      updateSegmentedLiquid(false);
    });
    document.addEventListener("DOMContentLoaded", function () {
      document.querySelectorAll(".accordion-card .accordion-header").forEach(function (header) {
        header.addEventListener("click", function () {
          var card = header.closest(".accordion-card");
          if (!card) return;
          var open = card.getAttribute("data-open") === "true";
          card.setAttribute("data-open", open ? "false" : "true");
        });
      });
    });
  
