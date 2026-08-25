(() => {
  const DATABASE_NAME = "seung-won-lee-portfolio-media";
  const DATABASE_VERSION = 2;
  const ASSET_STORE = "assets";
  const ASSIGNMENT_STORE = "assignments";
  const PROJECT_STORE = "projects";
  const PROJECT_STATE_KEY = "portfolio";
  const MAX_FILE_SIZE = 80 * 1024 * 1024;
  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);
  const ALLOWED_EXTENSIONS = /\.(?:jpe?g|png|webp|gif|avif|mp4|webm|mov)$/i;

  let database = null;
  let portfolioItems = [];
  let defaultItems = [];
  let assets = [];
  let assetsById = new Map();
  let assignments = new Map();
  let assetUrls = new Map();
  let controlsReady = false;

  const elements = {
    launcher: document.querySelector("#media-library-open"),
    dialog: document.querySelector("#media-library"),
    close: document.querySelector("#media-library-close"),
    add: document.querySelector("#media-library-add"),
    input: document.querySelector("#media-library-input"),
    save: document.querySelector("#media-library-save"),
    status: document.querySelector("#media-library-status"),
    count: document.querySelector("#media-library-count"),
    assetList: document.querySelector("#media-library-assets"),
    assignmentList: document.querySelector("#media-library-assignments"),
    projectList: document.querySelector("#media-library-projects"),
    projectAdd: document.querySelector("#media-library-project-add"),
    projectSave: document.querySelector("#media-library-project-save"),
    projectReset: document.querySelector("#media-library-project-reset"),
    projectExport: document.querySelector("#media-library-project-export"),
  };

  const itemKey = (item) => item.id || `${item.kind}:${item.label}`;
  const createId = () =>
    `media-${
      crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }`;
  const createProjectId = () =>
    `project-${
      crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }`;
  const cloneItems = (items) => {
    if (typeof structuredClone === "function") return structuredClone(items);
    return JSON.parse(JSON.stringify(items));
  };

  const requestResult = (request) =>
    new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });

  const transactionDone = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.addEventListener("complete", resolve, { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
    });

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.addEventListener("upgradeneeded", () => {
        const nextDatabase = request.result;

        if (!nextDatabase.objectStoreNames.contains(ASSET_STORE)) {
          nextDatabase.createObjectStore(ASSET_STORE, { keyPath: "id" });
        }

        if (!nextDatabase.objectStoreNames.contains(ASSIGNMENT_STORE)) {
          nextDatabase.createObjectStore(ASSIGNMENT_STORE, { keyPath: "itemKey" });
        }

        if (!nextDatabase.objectStoreNames.contains(PROJECT_STORE)) {
          nextDatabase.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }
      });

      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
  }

  function readAll(storeName) {
    const transaction = database.transaction(storeName, "readonly");
    return requestResult(transaction.objectStore(storeName).getAll());
  }

  function revokeAssetUrls() {
    assetUrls.forEach((url) => URL.revokeObjectURL(url));
    assetUrls.clear();
  }

  async function loadState() {
    const [storedAssets, storedAssignments, storedProjects] = await Promise.all([
      readAll(ASSET_STORE),
      readAll(ASSIGNMENT_STORE),
      readAll(PROJECT_STORE),
    ]);

    const projectState = storedProjects.find((entry) => entry.id === PROJECT_STATE_KEY);
    if (projectState?.items?.length) {
      const defaultItemsById = new Map(defaultItems.map((item) => [itemKey(item), item]));
      const migratedItems = projectState.items.map((storedItem) => {
        const defaultItem = defaultItemsById.get(itemKey(storedItem));
        const hasLegacyArchive =
          storedItem.kind === "design" &&
          storedItem.gallery?.length === 3 &&
          defaultItem?.gallery?.length > 3;

        if (!defaultItem || !hasLegacyArchive) return storedItem;
        return {
          ...storedItem,
          gallery: cloneItems(defaultItem.gallery),
          galleryCaptions: cloneItems(defaultItem.galleryCaptions || []),
          galleryFit: cloneItems(defaultItem.galleryFit || []),
        };
      });
      portfolioItems.splice(0, portfolioItems.length, ...cloneItems(migratedItems));
    }

    revokeAssetUrls();
    assets = storedAssets.sort((a, b) => b.createdAt - a.createdAt);
    assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    assetUrls = new Map(assets.map((asset) => [asset.id, URL.createObjectURL(asset.blob)]));
    assignments = new Map(
      storedAssignments.map((assignment) => [assignment.itemKey, assignment.assetId]),
    );
  }

  // Local preview only. The editor is deliberately unreachable on the published
  // site — there is no query string or other escape hatch that reveals it.
  function editorIsAvailable() {
    const localHostname = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    return location.protocol === "file:" || localHostname;
  }

  function setStatus(message, isError = false) {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.classList.toggle("is-error", isError);
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function renderAssets() {
    if (!elements.assetList || !elements.count) return;
    elements.assetList.replaceChildren();
    elements.count.textContent = `${assets.length} ${assets.length === 1 ? "file" : "files"}`;

    if (!assets.length) {
      const empty = document.createElement("p");
      empty.className = "media-library-empty";
      empty.textContent = "No uploaded media yet.";
      elements.assetList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    assets.forEach((asset) => {
      const card = document.createElement("article");
      card.className = "media-asset-card";

      const preview = document.createElement(
        asset.type.startsWith("video/") ? "video" : "img",
      );
      preview.src = assetUrls.get(asset.id);
      if (preview instanceof HTMLVideoElement) {
        preview.muted = true;
        preview.playsInline = true;
        preview.preload = "metadata";
      } else {
        preview.alt = "";
        preview.loading = "lazy";
      }

      const details = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = asset.name;
      name.title = asset.name;

      const metadata = document.createElement("span");
      metadata.textContent = `${asset.type.replace(/^(?:image|video)\//, "").toUpperCase()} · ${formatBytes(asset.size)}`;

      details.append(name, metadata);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "media-asset-remove";
      remove.dataset.assetId = asset.id;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${asset.name} from the media library`);

      card.append(preview, details, remove);
      fragment.append(card);
    });

    elements.assetList.append(fragment);
  }

  function createAssetSelect(assignmentKey, item, fallback, labelText) {
    const field = document.createElement("label");
    field.className = "media-assignment-field";

    const label = document.createElement("span");
    label.textContent = labelText;

    const select = document.createElement("select");
    select.dataset.assignmentKey = assignmentKey;
    select.setAttribute("aria-label", `${labelText} for ${item.label}`);

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = fallback
      ? `Site default — ${String(fallback).split("/").pop()}`
      : "Site default — no media";
    select.append(defaultOption);

    assets.forEach((asset) => {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = asset.name;
      select.append(option);
    });

    const assignedAsset = assignments.get(assignmentKey);
    select.value = assetsById.has(assignedAsset) ? assignedAsset : "";
    field.append(label, select);
    return field;
  }

  function renderAssignments() {
    if (!elements.assignmentList) return;
    elements.assignmentList.replaceChildren();
    const fragment = document.createDocumentFragment();

    portfolioItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "media-assignment";

      const project = document.createElement("span");
      project.className = "media-assignment-project";

      const kind = document.createElement("small");
      kind.textContent = item.kind === "design" ? "Design" : "Research";

      const name = document.createElement("strong");
      name.textContent = item.label;
      project.append(kind, name);

      const controls = document.createElement("div");
      controls.className = "media-assignment-controls";
      controls.append(createAssetSelect(itemKey(item), item, item.image, "Main preview"));

      if (item.kind === "design") {
        const galleryLength = Math.max(item.gallery?.length || 0, 3);
        const gallery = Array.from(
          { length: galleryLength },
          (_, index) => item.gallery?.[index] || null,
        );
        gallery.forEach((fallback, index) => {
          controls.append(
            createAssetSelect(
              `${itemKey(item)}::gallery:${index}`,
              item,
              fallback,
              item.galleryCaptions?.[index] || `Archive ${index + 1}`,
            ),
          );
        });
      }

      row.append(project, controls);
      fragment.append(row);
    });

    elements.assignmentList.append(fragment);
  }

  function classifyTags(tags = []) {
    const remaining = [...tags];
    const take = (pattern) => {
      const index = remaining.findIndex((tag) => pattern.test(tag));
      return index === -1 ? "" : remaining.splice(index, 1)[0];
    };

    return {
      index: take(/^(?:~?SCIE?|SSCI|SCOPUS|KCI|A&HCI)$/i),
      rank: take(/^TOP(?:\s|-)/i),
      metric: take(/^(?:IF|H5)\s*=/i),
      extra: remaining.join(", "),
    };
  }

  function createProjectField(labelText, fieldName, value, options = {}) {
    const field = document.createElement("label");
    field.className = "media-project-field";
    if (options.wide) field.classList.add("is-wide");

    const label = document.createElement("span");
    label.textContent = labelText;

    let control;
    if (options.choices) {
      control = document.createElement("select");
      options.choices.forEach(([choiceValue, choiceLabel]) => {
        const option = document.createElement("option");
        option.value = choiceValue;
        option.textContent = choiceLabel;
        control.append(option);
      });
    } else {
      control = document.createElement("input");
      control.type = options.type || "text";
      if (options.placeholder) control.placeholder = options.placeholder;
    }

    control.dataset.field = fieldName;
    control.value = value ?? "";
    field.append(label, control);
    return field;
  }

  function createProjectCard(item, open = false) {
    const card = document.createElement("details");
    card.className = "media-project-card";
    card.dataset.itemId = item.id;
    card.open = open;

    const summary = document.createElement("summary");
    const summaryText = document.createElement("span");
    const summaryKind = document.createElement("small");
    summaryKind.textContent = item.kind === "design" ? "Design" : "Research";
    const summaryName = document.createElement("strong");
    summaryName.textContent = item.label || "Untitled project";
    summaryText.append(summaryKind, summaryName);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "media-project-remove";
    remove.dataset.removeProject = item.id;
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${item.label || "untitled project"}`);
    summary.append(summaryText, remove);

    const tags = classifyTags(item.tags);
    const fields = document.createElement("div");
    fields.className = "media-project-fields";
    fields.append(
      createProjectField("Type", "kind", item.kind, {
        choices: [["research", "Research"], ["design", "Design"]],
      }),
      createProjectField("Display title", "label", item.label),
      createProjectField("Full title", "title", item.title, { wide: true }),
      createProjectField("Short description", "descriptor", item.descriptor, { wide: true }),
      createProjectField("Venue / category", "venue", item.venue),
      createProjectField("Year", "year", item.year),
      createProjectField("DOI / project URL", "url", item.url, {
        type: "url",
        placeholder: "https://doi.org/...",
        wide: true,
      }),
      createProjectField("Authorship", "contribution", item.contribution, {
        placeholder: "1st Author / Co-author",
      }),
      createProjectField("Index", "tagIndex", tags.index, {
        placeholder: "SCIE / ~SCIE / SCOPUS / KCI",
      }),
      createProjectField("Rank", "tagRank", tags.rank, {
        placeholder: "TOP 2% / TOP-TIER",
      }),
      createProjectField("Metric", "tagMetric", tags.metric, {
        placeholder: "IF=11.500 / H5=139",
      }),
      createProjectField("Extra tags", "tagExtra", tags.extra, {
        placeholder: "Comma-separated",
      }),
      createProjectField("Image fit", "fit", item.fit || "contain", {
        choices: [["contain", "Contain"], ["cover", "Cover"]],
      }),
      createProjectField("Stage tone", "tone", item.tone || "#deddd9", {
        placeholder: "#deddd9",
      }),
    );

    card.append(summary, fields);
    return card;
  }

  function renderProjects() {
    if (!elements.projectList) return;
    elements.projectList.replaceChildren(
      ...portfolioItems.map((item) => createProjectCard(item)),
    );
  }

  function renderEditor() {
    renderAssets();
    renderAssignments();
    renderProjects();
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    const accepted = files.filter(
      (file) =>
        (ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.test(file.name)) &&
        file.size <= MAX_FILE_SIZE,
    );

    if (!accepted.length) {
      setStatus("Choose JPG, PNG, WebP, GIF, AVIF, MP4, WebM, or MOV files under 80 MB.", true);
      return;
    }

    const transaction = database.transaction(ASSET_STORE, "readwrite");
    const store = transaction.objectStore(ASSET_STORE);

    accepted.forEach((file) => {
      const fallbackType = /\.(?:mp4|webm|mov)$/i.test(file.name)
        ? "video/unknown"
        : "image/unknown";
      store.put({
        id: createId(),
        name: file.name,
        type: file.type || fallbackType,
        size: file.size,
        createdAt: Date.now(),
        blob: file,
      });
    });

    await transactionDone(transaction);
    await loadState();
    renderEditor();

    const skipped = files.length - accepted.length;
    setStatus(
      `${accepted.length} ${accepted.length === 1 ? "file" : "files"} added and saved${
        skipped ? `; ${skipped} skipped` : ""
      }.`,
      false,
    );
  }

  async function saveAssignments() {
    const nextAssignments = new Map();

    elements.assignmentList
      .querySelectorAll("select[data-assignment-key]")
      .forEach((select) => {
        if (select.value) {
          nextAssignments.set(select.dataset.assignmentKey, select.value);
        }
      });

    const transaction = database.transaction(ASSIGNMENT_STORE, "readwrite");
    const store = transaction.objectStore(ASSIGNMENT_STORE);
    store.clear();
    nextAssignments.forEach((assetId, key) => store.put({ itemKey: key, assetId }));

    await transactionDone(transaction);
    assignments = nextAssignments;
    setStatus("Project links saved in this browser.");
    document.dispatchEvent(new CustomEvent("portfolio-media-change"));
  }

  function valuesFromProjectCard(card) {
    const values = {};
    card.querySelectorAll("[data-field]").forEach((control) => {
      values[control.dataset.field] = control.value.trim();
    });
    return values;
  }

  function projectFromCard(card) {
    const values = valuesFromProjectCard(card);
    const previous = portfolioItems.find((item) => item.id === card.dataset.itemId) || {};
    const tags = [values.tagIndex, values.tagRank, values.tagMetric]
      .concat(values.tagExtra.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);
    const kind = values.kind === "design" ? "design" : "research";
    const label = values.label || values.title || "Untitled project";

    return {
      ...previous,
      id: card.dataset.itemId,
      kind,
      label,
      title: values.title || label,
      descriptor: values.descriptor,
      venue: values.venue,
      year: values.year,
      url: values.url,
      contribution: values.contribution,
      tags,
      image: previous.image || null,
      reducedImage: previous.reducedImage || null,
      alt: previous.alt || "",
      fit: values.fit === "cover" ? "cover" : "contain",
      tone: values.tone || "#deddd9",
      gallery:
        kind === "design"
          ? Array.from(
              { length: Math.max(previous.gallery?.length || 0, 3) },
              (_, index) => previous.gallery?.[index] || null,
            )
          : undefined,
    };
  }

  function collectProjectCards() {
    return [...elements.projectList.querySelectorAll(".media-project-card")].map(
      projectFromCard,
    );
  }

  function assignmentKeysFor(items) {
    const keys = new Set();
    items.forEach((item) => {
      keys.add(itemKey(item));
      if (item.kind === "design") {
        const galleryLength = Math.max(item.gallery?.length || 0, 3);
        for (let index = 0; index < galleryLength; index += 1) {
          keys.add(`${itemKey(item)}::gallery:${index}`);
        }
      }
    });
    return keys;
  }

  async function storeProjects(nextItems, reset = false) {
    const allowedKeys = assignmentKeysFor(nextItems);
    const nextAssignments = new Map(
      [...assignments].filter(([key, assetId]) => allowedKeys.has(key) && assetsById.has(assetId)),
    );
    const transaction = database.transaction(
      [PROJECT_STORE, ASSIGNMENT_STORE],
      "readwrite",
    );

    const projectStore = transaction.objectStore(PROJECT_STORE);
    if (reset) projectStore.delete(PROJECT_STATE_KEY);
    else {
      projectStore.put({
        id: PROJECT_STATE_KEY,
        items: cloneItems(nextItems),
        updatedAt: Date.now(),
      });
    }

    const assignmentStore = transaction.objectStore(ASSIGNMENT_STORE);
    assignmentStore.clear();
    nextAssignments.forEach((assetId, key) =>
      assignmentStore.put({ itemKey: key, assetId }),
    );
    await transactionDone(transaction);

    assignments = nextAssignments;
    portfolioItems.splice(0, portfolioItems.length, ...cloneItems(nextItems));
  }

  async function saveProjects() {
    const nextItems = collectProjectCards();
    if (!nextItems.length) {
      setStatus("Keep at least one project in the portfolio.", true);
      return;
    }

    await storeProjects(nextItems);
    renderEditor();
    setStatus(`${nextItems.length} projects and publication tags saved in this browser.`);
    document.dispatchEvent(new CustomEvent("portfolio-projects-change"));
  }

  function addProject() {
    const item = {
      id: createProjectId(),
      kind: "research",
      label: "New Project",
      title: "New Project",
      descriptor: "",
      venue: "",
      year: "",
      url: "",
      contribution: "",
      tags: [],
      image: null,
      reducedImage: null,
      alt: "",
      fit: "contain",
      tone: "#deddd9",
    };
    const card = createProjectCard(item, true);
    elements.projectList.append(card);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.querySelector('[data-field="label"]')?.select();
    setStatus("New project added to the editor. Select Save projects to keep it.");
  }

  function removeProjectCard(projectId) {
    const cards = elements.projectList.querySelectorAll(".media-project-card");
    if (cards.length <= 1) {
      setStatus("Keep at least one project in the portfolio.", true);
      return;
    }

    const card = elements.projectList.querySelector(`[data-item-id="${CSS.escape(projectId)}"]`);
    const label = card?.querySelector('[data-field="label"]')?.value || "this project";
    if (!card || !window.confirm(`Delete ${label} from the editor?`)) return;
    card.remove();
    setStatus("Project removed from the editor. Select Save projects to confirm.");
  }

  async function resetProjects() {
    if (!window.confirm("Restore the projects and publication tags from content.js?")) return;
    await storeProjects(defaultItems, true);
    renderEditor();
    setStatus("Project data restored from content.js.");
    document.dispatchEvent(new CustomEvent("portfolio-projects-change"));
  }

  function exportProjects() {
    const nextItems = collectProjectCards();
    if (!nextItems.length) {
      setStatus("Keep at least one project before exporting content.js.", true);
      return;
    }

    const exportData = {
      cycleDuration: Number(window.PORTFOLIO_DATA?.cycleDuration) || 4000,
      items: nextItems,
    };
    const source = `/* Exported from the portfolio Media Library. */\nwindow.PORTFOLIO_DATA = ${JSON.stringify(
      exportData,
      null,
      2,
    )};\n`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = "content.js";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("content.js exported. Replace the repository file and commit to publish it.");
  }

  async function removeAsset(assetId) {
    const asset = assetsById.get(assetId);
    if (!asset || !window.confirm(`Remove ${asset.name} from this browser?`)) return;

    const affectedKeys = [...assignments]
      .filter(([, assignedAssetId]) => assignedAssetId === assetId)
      .map(([key]) => key);
    const transaction = database.transaction(
      [ASSET_STORE, ASSIGNMENT_STORE],
      "readwrite",
    );

    transaction.objectStore(ASSET_STORE).delete(assetId);
    affectedKeys.forEach((key) => transaction.objectStore(ASSIGNMENT_STORE).delete(key));
    await transactionDone(transaction);

    await loadState();
    renderEditor();
    setStatus(`${asset.name} removed.`);
    document.dispatchEvent(new CustomEvent("portfolio-media-change"));
  }

  function openDialog() {
    renderEditor();
    setStatus("Media, project details, and publication tags are stored locally when saved.");

    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    else elements.dialog.setAttribute("open", "");
  }

  function closeDialog() {
    if (typeof elements.dialog.close === "function") elements.dialog.close();
    else elements.dialog.removeAttribute("open");
  }

  function setupControls() {
    if (controlsReady || !elements.dialog) return;
    controlsReady = true;

    elements.launcher.addEventListener("click", openDialog);
    elements.close.addEventListener("click", closeDialog);
    elements.add.addEventListener("click", () => elements.input.click());
    elements.input.addEventListener("change", async () => {
      try {
        await addFiles(elements.input.files);
      } catch (error) {
        console.error(error);
        setStatus("The selected media could not be saved.", true);
      } finally {
        elements.input.value = "";
      }
    });
    elements.save.addEventListener("click", async () => {
      try {
        await saveAssignments();
      } catch (error) {
        console.error(error);
        setStatus("Project links could not be saved.", true);
      }
    });
    elements.projectAdd?.addEventListener("click", addProject);
    elements.projectSave?.addEventListener("click", async () => {
      try {
        await saveProjects();
      } catch (error) {
        console.error(error);
        setStatus("Project details could not be saved.", true);
      }
    });
    elements.projectReset?.addEventListener("click", async () => {
      try {
        await resetProjects();
      } catch (error) {
        console.error(error);
        setStatus("The default project data could not be restored.", true);
      }
    });
    elements.projectExport?.addEventListener("click", exportProjects);
    elements.projectList?.addEventListener("click", (event) => {
      const removeButton = event.target.closest("button[data-remove-project]");
      if (!removeButton) return;
      event.preventDefault();
      event.stopPropagation();
      removeProjectCard(removeButton.dataset.removeProject);
    });
    elements.assetList.addEventListener("click", async (event) => {
      const removeButton = event.target.closest("button[data-asset-id]");
      if (!removeButton) return;

      try {
        await removeAsset(removeButton.dataset.assetId);
      } catch (error) {
        console.error(error);
        setStatus("The media file could not be removed.", true);
      }
    });
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) closeDialog();
    });
  }

  async function init(items) {
    portfolioItems = items;
    defaultItems = cloneItems(items);
    setupControls();
    elements.launcher.hidden = !editorIsAvailable();

    if (!("indexedDB" in window)) {
      elements.add.disabled = true;
      elements.save.disabled = true;
      if (elements.projectAdd) elements.projectAdd.disabled = true;
      if (elements.projectSave) elements.projectSave.disabled = true;
      if (elements.projectReset) elements.projectReset.disabled = true;
      if (elements.projectExport) elements.projectExport.disabled = true;
      setStatus("This browser does not support persistent local media storage.", true);
      return;
    }

    try {
      database = await openDatabase();
      await loadState();
      renderEditor();
    } catch (error) {
      console.error(error);
      elements.add.disabled = true;
      elements.save.disabled = true;
      if (elements.projectAdd) elements.projectAdd.disabled = true;
      if (elements.projectSave) elements.projectSave.disabled = true;
      if (elements.projectReset) elements.projectReset.disabled = true;
      if (elements.projectExport) elements.projectExport.disabled = true;
      setStatus("The browser media library could not be opened.", true);
    }
  }

  function resolve(item, fallback, { reduceMotion = false } = {}) {
    const assetId = assignments.get(itemKey(item));
    const asset = assetsById.get(assetId);

    if (
      !asset ||
      (reduceMotion && (asset.type === "image/gif" || asset.type.startsWith("video/")))
    ) {
      return fallback;
    }
    return assetUrls.get(assetId) || fallback;
  }

  function resolveGallery(item, index, fallback, { reduceMotion = false } = {}) {
    const assetId = assignments.get(`${itemKey(item)}::gallery:${index}`);
    const asset = assetsById.get(assetId);

    if (
      !asset ||
      (reduceMotion && (asset.type === "image/gif" || asset.type.startsWith("video/")))
    ) {
      return fallback;
    }
    return assetUrls.get(assetId) || fallback;
  }

  function isVideo(item, galleryIndex = null) {
    const key =
      galleryIndex === null
        ? itemKey(item)
        : `${itemKey(item)}::gallery:${galleryIndex}`;
    return assetsById.get(assignments.get(key))?.type.startsWith("video/") || false;
  }

  window.PortfolioMediaLibrary = { init, resolve, resolveGallery, isVideo };
})();
