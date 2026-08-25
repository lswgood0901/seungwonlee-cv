(async () => {
  const data = window.PORTFOLIO_DATA;
  if (!data?.items?.length) return;

  const items = data.items;
  const mediaLibrary = window.PortfolioMediaLibrary;
  const cycleDuration = Math.max(2500, Number(data.cycleDuration) || 4000);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stage = document.querySelector("#media-stage");
  const previewDock = document.querySelector(".dock");
  const mediaWindow = stage.querySelector(".media-window");
  const mediaFrame = stage.querySelector(".media-frame");
  const stageImage = document.querySelector("#stage-image");
  const stageVideo = document.querySelector("#stage-video");
  const placeholder = document.querySelector("#media-placeholder");
  const placeholderTitle = document.querySelector("#placeholder-title");
  const stageIndex = document.querySelector("#stage-index");
  const stageKind = document.querySelector("#stage-kind");
  const stageTitle = document.querySelector("#stage-title");
  const stageMeta = document.querySelector("#stage-meta");
  const stageMode = document.querySelector("#stage-mode");
  const stageFullTitle = document.querySelector("#stage-fulltitle-text");
  const workIndex = document.querySelector("#work-index");
  const researchList = document.querySelector("#research-list");
  const designList = document.querySelector("#design-list");
  const rowElements = [];

  let currentIndex = 0;
  let timer = 0;
  let manualPreview = false;
  let lockedIndex = null;
  let renderToken = 0;

  const pad = (value) => String(value).padStart(2, "0");
  const videoExtension = /\.(?:mp4|webm|mov)(?:[?#].*)?$/i;
  const sourceIsVideo = (source, item, galleryIndex = null) => {
    if (!source) return false;
    if (!String(source).startsWith("blob:")) return videoExtension.test(source);
    return Boolean(mediaLibrary?.isVideo?.(item, galleryIndex));
  };
  // The frame carries the artwork's own ratio, so the preview never letterboxes.
  // Clamped so a very tall or very wide asset cannot break the column.
  const setMediaRatio = (width, height) => {
    if (!width || !height) {
      mediaFrame.style.removeProperty("--media-ar");
      return;
    }
    const ratio = Math.min(3.6, Math.max(1, width / height));
    mediaFrame.style.setProperty("--media-ar", String(ratio));
  };
  const mediaFor = (item) => {
    const fallback = reduceMotion.matches && item.reducedImage ? item.reducedImage : item.image;
    return mediaLibrary?.resolve(item, fallback, { reduceMotion: reduceMotion.matches }) || fallback;
  };
  const archiveMediaFor = (item, index) => {
    const fallback = item.gallery?.[index] || null;
    return (
      mediaLibrary?.resolveGallery?.(item, index, fallback, {
        reduceMotion: reduceMotion.matches,
      }) || fallback
    );
  };

  function createArchiveSlot(item, index) {
    const source = archiveMediaFor(item, index);
    const slot = document.createElement("figure");
    slot.className = "work-archive-slot";
    slot.dataset.fit = item.galleryFit?.[index] === "contain" ? "contain" : "cover";

    if (source) {
      if (sourceIsVideo(source, item, index)) {
        const video = document.createElement("video");
        video.src = source;
        video.controls = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute(
          "aria-label",
          item.galleryCaptions?.[index] || `${item.label} archive video ${index + 1}`,
        );
        slot.append(video);
      } else {
        const image = document.createElement("img");
        image.src = source;
        image.alt = item.galleryCaptions?.[index] || `${item.label} archive image ${index + 1}`;
        image.loading = "lazy";
        slot.append(image);
      }
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "work-archive-placeholder";
      placeholder.innerHTML = `<span>${pad(index + 1)}</span><strong>Archive placeholder</strong>`;
      slot.append(placeholder);
    }

    const caption = document.createElement("figcaption");
    caption.textContent = item.galleryCaptions?.[index] || `Archive ${pad(index + 1)}`;
    slot.append(caption);
    return slot;
  }

  function createRow(item, index, groupIndex) {
    const listItem = document.createElement("li");
    listItem.className = "work-item";

    const control = document.createElement("button");
    control.className = "work-link";
    control.type = "button";
    control.dataset.index = String(index);
    control.dataset.active = "false";
    control.dataset.locked = "false";
    control.setAttribute("aria-pressed", "false");
    control.setAttribute("aria-label", `Preview ${item.title}. Click to lock this preview.`);

    const number = document.createElement("span");
    number.className = "work-number";
    number.textContent = pad(groupIndex + 1);

    const titleBlock = document.createElement("span");
    titleBlock.className = "work-title-block";

    const title = document.createElement("span");
    title.className = "work-title";
    title.textContent = item.label;

    const descriptor = document.createElement("span");
    descriptor.className = "work-descriptor";
    descriptor.textContent = item.descriptor || item.title;

    titleBlock.append(title, descriptor);

    const meta = document.createElement("span");
    meta.className = "work-meta";

    const venue = document.createElement("span");
    venue.className = "work-venue";
    venue.textContent = item.venue;

    const year = document.createElement("span");
    year.className = "work-year";
    year.textContent = item.kind === "design" ? "" : item.year;

    meta.append(venue, year);

    const tags = document.createElement("span");
    tags.className = "work-tags";

    if (item.contribution) {
      const contribution = document.createElement("span");
      contribution.className = "work-tag work-contribution";
      contribution.textContent = item.contribution;
      tags.append(contribution);
    }

    (item.tags || []).forEach((tag) => {
      const venueTag = document.createElement("span");
      venueTag.className = "work-tag work-rank-tag";
      venueTag.textContent = tag;
      tags.append(venueTag);
    });

    control.append(number, titleBlock, meta, tags);
    listItem.append(control);

    if (item.url) {
      listItem.classList.add("has-outbound");

      const outbound = document.createElement("a");
      outbound.className = "work-outbound";
      outbound.href = item.url;
      outbound.target = "_blank";
      outbound.rel = "noreferrer";
      outbound.setAttribute("aria-label", `Open DOI for ${item.title}`);
      outbound.title = "Open DOI";

      const outboundLabel = document.createElement("span");
      outboundLabel.className = "work-outbound-label";
      outboundLabel.textContent = "DOI";

      const outboundIcon = document.createElement("span");
      outboundIcon.className = "work-outbound-icon";
      outboundIcon.setAttribute("aria-hidden", "true");
      outboundIcon.textContent = "↗";

      outbound.append(outboundLabel, outboundIcon);
      listItem.append(outbound);
    }

    if (item.kind === "design") {
      listItem.classList.add("has-archive");
      const archiveId = `archive-${item.id}`;
      const galleryLength = Math.max(
        item.gallery?.length || 0,
        item.galleryCaptions?.length || 0,
        item.galleryFit?.length || 0,
        3,
      );
      const archiveToggle = document.createElement("button");
      archiveToggle.className = "work-archive-toggle";
      archiveToggle.type = "button";
      archiveToggle.setAttribute("aria-expanded", "false");
      archiveToggle.setAttribute("aria-controls", archiveId);
      archiveToggle.innerHTML = '<span>View archive</span><b aria-hidden="true">＋</b>';

      const archive = document.createElement("section");
      archive.className = "work-archive";
      archive.id = archiveId;
      archive.hidden = true;

      const archiveToolbar = document.createElement("div");
      archiveToolbar.className = "work-archive-toolbar";

      const archiveCount = document.createElement("span");
      archiveCount.className = "work-archive-count";
      archiveCount.textContent = `${pad(galleryLength)} media`;

      const archiveNav = document.createElement("span");
      archiveNav.className = "work-archive-nav";

      const archivePrevious = document.createElement("button");
      archivePrevious.type = "button";
      archivePrevious.className = "work-archive-arrow";
      archivePrevious.textContent = "←";
      archivePrevious.setAttribute("aria-label", `Previous ${item.label} archive media`);

      const archiveNext = document.createElement("button");
      archiveNext.type = "button";
      archiveNext.className = "work-archive-arrow";
      archiveNext.textContent = "→";
      archiveNext.setAttribute("aria-label", `Next ${item.label} archive media`);

      archiveNav.append(archivePrevious, archiveNext);
      archiveToolbar.append(archiveCount, archiveNav);

      const archiveTrack = document.createElement("div");
      archiveTrack.className = "work-archive-track";
      archiveTrack.tabIndex = 0;
      archiveTrack.setAttribute("aria-label", `${item.label} media archive`);
      archiveTrack.append(
        ...Array.from({ length: galleryLength }, (_, slotIndex) =>
          createArchiveSlot(item, slotIndex),
        ),
      );

      const scrollArchive = (direction) => {
        const firstSlot = archiveTrack.querySelector(".work-archive-slot");
        const distance = firstSlot
          ? firstSlot.getBoundingClientRect().width + 10
          : archiveTrack.clientWidth * 0.72;
        archiveTrack.scrollBy({ left: distance * direction, behavior: "smooth" });
      };

      archivePrevious.addEventListener("click", () => scrollArchive(-1));
      archiveNext.addEventListener("click", () => scrollArchive(1));
      archive.append(archiveToolbar, archiveTrack);

      archiveToggle.addEventListener("click", () => {
        const willOpen = archive.hidden;
        document.querySelectorAll(".work-archive:not([hidden])").forEach((openArchive) => {
          if (openArchive === archive) return;
          openArchive.hidden = true;
          const otherToggle = openArchive.parentElement.querySelector(".work-archive-toggle");
          if (otherToggle) {
            otherToggle.setAttribute("aria-expanded", "false");
            otherToggle.querySelector("span").textContent = "View archive";
            otherToggle.querySelector("b").textContent = "＋";
          }
        });

        archive.hidden = !willOpen;
        archiveToggle.setAttribute("aria-expanded", String(willOpen));
        archiveToggle.querySelector("span").textContent = willOpen ? "Close archive" : "View archive";
        archiveToggle.querySelector("b").textContent = willOpen ? "−" : "＋";
        if (willOpen) lockPreview(index);
      });

      listItem.append(archiveToggle, archive);
    }

    rowElements[index] = control;

    control.addEventListener("pointerenter", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      beginManualPreview(index);
    });

    control.addEventListener("focus", () => beginManualPreview(index));

    control.addEventListener("click", () => toggleLock(index));

    return listItem;
  }

  function renderLists() {
    let researchIndex = 0;
    let designIndex = 0;

    researchList.replaceChildren();
    designList.replaceChildren();
    rowElements.length = 0;

    items.forEach((item, index) => {
      if (item.kind === "design") {
        designList.append(createRow(item, index, designIndex));
        designIndex += 1;
      } else {
        researchList.append(createRow(item, index, researchIndex));
        researchIndex += 1;
      }
    });
  }

  function commitMedia(item, source, token, natural) {
    if (token !== renderToken) return;

    // Videos report their size only on loadedmetadata, so hold the previous
    // ratio until then rather than flashing through the default frame.
    if (natural) {
      setMediaRatio(natural[0], natural[1]);
    } else if (!source) {
      setMediaRatio(0, 0);
    }

    mediaWindow.style.setProperty("--stage-tone", item.tone || "#deddd9");
    mediaWindow.dataset.fit = item.fit === "cover" ? "cover" : "contain";
    stageImage.dataset.fit = item.fit === "cover" ? "cover" : "contain";
    stageVideo.dataset.fit = item.fit === "cover" ? "cover" : "contain";

    if (source) {
      const videoSource = sourceIsVideo(source, item);
      mediaWindow.dataset.hasMedia = "true";
      mediaWindow.dataset.mediaType = videoSource ? "video" : "image";

      if (videoSource) {
        mediaWindow.style.removeProperty("--stage-image");
        stageImage.removeAttribute("src");
        stageImage.alt = "";
        stageImage.hidden = true;
        stageVideo.src = source;
        // Show the still immediately; a video paints nothing until it buffers.
        if (item.reducedImage) {
          stageVideo.poster = item.reducedImage;
        } else {
          stageVideo.removeAttribute("poster");
        }
        stageVideo.setAttribute("aria-label", item.alt || `${item.label} project video`);
        stageVideo.hidden = false;
        if (!reduceMotion.matches) stageVideo.play().catch(() => {});
      } else {
        stageVideo.pause();
        stageVideo.removeAttribute("src");
        stageVideo.removeAttribute("aria-label");
        stageVideo.removeAttribute("poster");
        stageVideo.load();
        stageVideo.hidden = true;
        mediaWindow.style.setProperty("--stage-image", `url(${JSON.stringify(source)})`);
        stageImage.src = source;
        stageImage.alt = item.alt || "";
        stageImage.hidden = false;
      }
      placeholder.hidden = true;
    } else {
      mediaWindow.dataset.hasMedia = "false";
      mediaWindow.dataset.mediaType = "none";
      mediaWindow.style.removeProperty("--stage-image");
      stageVideo.pause();
      stageVideo.removeAttribute("src");
      stageVideo.removeAttribute("aria-label");
      stageVideo.load();
      stageVideo.hidden = true;
      stageImage.removeAttribute("src");
      stageImage.alt = "";
      stageImage.hidden = true;
      placeholderTitle.textContent = item.label;
      placeholder.hidden = false;
    }

    window.requestAnimationFrame(() => stage.classList.remove("is-changing"));
  }

  function setActive(index, immediate = false) {
    currentIndex = (index + items.length) % items.length;
    const item = items[currentIndex];
    const source = mediaFor(item);
    const token = ++renderToken;

    rowElements.forEach((row, rowIndex) => {
      row.dataset.active = String(rowIndex === currentIndex);
    });

    stageIndex.textContent = `${pad(currentIndex + 1)} / ${pad(items.length)}`;
    stageFullTitle.textContent = item.title || item.label;
    stageKind.textContent = item.kind === "design" ? "Design project" : "Research";
    stageTitle.textContent = item.label;
    stageTitle.title = item.title;
    stageMeta.textContent =
      item.kind !== "design" && item.year ? `${item.venue} · ${item.year}` : item.venue;

    if (immediate || reduceMotion.matches) {
      commitMedia(item, source, token);
      return;
    }

    stage.classList.add("is-changing");

    if (!source) {
      window.setTimeout(() => commitMedia(item, null, token), 150);
      return;
    }

    if (sourceIsVideo(source, item)) {
      window.setTimeout(() => commitMedia(item, source, token), 120);
      return;
    }

    const loader = new Image();
    loader.onload = () =>
      window.setTimeout(
        () => commitMedia(item, source, token, [loader.naturalWidth, loader.naturalHeight]),
        120,
      );
    loader.onerror = () => window.setTimeout(() => commitMedia(item, null, token), 120);
    loader.src = source;
  }

  function updateMode() {
    if (reduceMotion.matches) {
      stageMode.textContent = "Manual / reduced motion";
    } else if (lockedIndex !== null) {
      stageMode.textContent = "Locked / click to release";
    } else if (manualPreview) {
      stageMode.textContent = "Hover / paused";
    } else {
      stageMode.textContent = `Auto / ${Math.round(cycleDuration / 1000)} sec`;
    }
  }

  function stopAuto() {
    window.clearTimeout(timer);
    timer = 0;
  }

  function startAuto() {
    stopAuto();
    updateMode();
    if (manualPreview || lockedIndex !== null || reduceMotion.matches || document.hidden) return;

    timer = window.setTimeout(() => {
      setActive(currentIndex + 1);
      startAuto();
    }, cycleDuration);
  }

  function beginManualPreview(index) {
    if (lockedIndex !== null) return;
    manualPreview = true;
    stopAuto();
    updateMode();
    setActive(index);
  }

  function endManualPreview() {
    if (lockedIndex !== null) return;
    manualPreview = false;
    startAuto();
  }

  function syncLockState() {
    workIndex.dataset.locked = String(lockedIndex !== null);

    rowElements.forEach((row, rowIndex) => {
      const locked = rowIndex === lockedIndex;
      row.dataset.locked = String(locked);
      row.setAttribute("aria-pressed", String(locked));
      row.setAttribute(
        "aria-label",
        locked
          ? `Preview locked on ${items[rowIndex].title}. Click to release.`
          : `Preview ${items[rowIndex].title}. Click to lock this preview.`,
      );
    });
  }

  function toggleLock(index) {
    if (lockedIndex === index) {
      lockedIndex = null;
      manualPreview = false;
      syncLockState();
      startAuto();
      return;
    }

    lockPreview(index);
  }

  function lockPreview(index) {
    lockedIndex = index;
    manualPreview = false;
    stopAuto();
    syncLockState();
    setActive(index);
    updateMode();
  }

  workIndex.addEventListener("pointerleave", (event) => {
    if (!event.pointerType || event.pointerType === "mouse") endManualPreview();
  });

  workIndex.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (!workIndex.contains(document.activeElement)) endManualPreview();
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAuto();
    else startAuto();
  });

  reduceMotion.addEventListener?.("change", () => {
    setActive(currentIndex, true);
    startAuto();
  });

  function preloadRemainingMedia() {
    items.slice(1).forEach((item) => {
      const source = mediaFor(item);
      if (!source) return;
      if (sourceIsVideo(source, item)) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = source;
      } else {
        new Image().src = source;
      }
    });
  }

  // Only used below 1100px, where the dock is pinned and the index needs to
  // clear it. On wider screens the dock is display:contents and reports 0.
  function syncDockHeight() {
    const height = Math.ceil(previewDock?.getBoundingClientRect().height || 0);
    if (height > 0) {
      document.documentElement.style.setProperty("--dock-height", `${height}px`);
    }
  }

  if ("ResizeObserver" in window && previewDock) {
    const previewSizeObserver = new ResizeObserver(syncDockHeight);
    previewSizeObserver.observe(previewDock);
  }
  window.addEventListener("resize", syncDockHeight);

  stageVideo.addEventListener("loadedmetadata", () =>
    setMediaRatio(stageVideo.videoWidth, stageVideo.videoHeight),
  );
  stageImage.addEventListener("load", () =>
    setMediaRatio(stageImage.naturalWidth, stageImage.naturalHeight),
  );

  document.querySelector("#current-year").textContent = String(new Date().getFullYear());
  await mediaLibrary?.init(items);
  renderLists();
  syncDockHeight();

  document.addEventListener("portfolio-media-change", () => {
    renderLists();
    syncLockState();
    setActive(currentIndex, true);
  });

  document.addEventListener("portfolio-projects-change", () => {
    lockedIndex = null;
    manualPreview = false;
    currentIndex = Math.min(currentIndex, items.length - 1);
    renderLists();
    syncLockState();
    setActive(currentIndex, true);
    startAuto();
  });

  setActive(0, true);
  startAuto();

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preloadRemainingMedia, { timeout: 1800 });
  } else {
    window.setTimeout(preloadRemainingMedia, 900);
  }
})();
