const authMsg = document.getElementById("auth-msg");
const jobMsg = document.getElementById("job-msg");
const dashboard = document.getElementById("dashboard");
const jobsContainer = document.getElementById("jobs");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const jobForm = document.getElementById("job-form");
const logoutBtn = document.getElementById("logout-btn");
const mobileAddToggleBtn = document.getElementById("mobile-add-toggle");
const mobileMapToggleBtn = document.getElementById("mobile-map-toggle");
const addJobPanel = document.getElementById("add-job-panel");
const authPanel = document.getElementById("auth-panel");
const hero = document.getElementById("hero");
const expandedJobIds = new Set();
const jobLinkInput = document.querySelector("#job-form input[name=\"link\"]");
const jobKeypointsInput = document.querySelector("#job-form textarea[name=\"keypoints\"]");
const jobKeypointsTags = document.getElementById("job-keypoints-tags");
const generateKeypointsBtn = document.getElementById("generate-keypoints-btn");
const cityInput = document.getElementById("job-city-input");
const cityOptions = document.getElementById("city-options");
const mapViewport = document.getElementById("flat-map-viewport");
const mapStage = document.getElementById("flat-map-stage");
const mapMarkers = document.getElementById("flat-map-markers");
const mapSummary = document.getElementById("map-summary");
const mapZoomInBtn = document.getElementById("map-zoom-in");
const mapZoomOutBtn = document.getElementById("map-zoom-out");
const mapResetViewBtn = document.getElementById("map-reset-view");
const leftTabAddBtn = document.getElementById("left-tab-add");
const leftTabMapBtn = document.getElementById("left-tab-map");
const leftViewAdd = document.getElementById("left-view-add");
const leftViewMap = document.getElementById("left-view-map");
const cityFilterLabel = document.getElementById("city-filter-label");
const clearCityFilterBtn = document.getElementById("clear-city-filter");
const mobileAddMediaQuery = window.matchMedia("(max-width: 700px)");
let isMobilePanelOpen = false;
const cityLookup = new Map();
let citySearchDebounce = null;
const DEFAULT_MAP_ZOOM = 1.45;
let isMapReady = false;
let mapZoom = DEFAULT_MAP_ZOOM;
let mapPanX = 0;
let mapPanY = 0;
let mapDragging = false;
let mapDidPan = false;
let mapLastX = 0;
let mapLastY = 0;
let mapStageWidth = 1;
let mapStageHeight = 1;
let mapStageLeft = 0;
let mapStageTop = 0;
let latestJobs = [];
let selectedCityKey = "";
let selectedCityLabel = "";
let activeLeftView = "add";
const MAP_ASPECT_RATIO = 2000 / 857;
const ROBINSON_LAT_STEP = 5;
const ROBINSON_FXC = 0.8487;
const ROBINSON_FYC = 1.3523;
const ROBINSON_X = [
  1,
  0.9986,
  0.9954,
  0.99,
  0.9822,
  0.973,
  0.96,
  0.9427,
  0.9216,
  0.8962,
  0.8679,
  0.835,
  0.7986,
  0.7597,
  0.7186,
  0.6732,
  0.6213,
  0.5722,
  0.5322,
];
const ROBINSON_Y = [
  0,
  0.062,
  0.124,
  0.186,
  0.248,
  0.31,
  0.372,
  0.434,
  0.4958,
  0.5571,
  0.6176,
  0.6769,
  0.7346,
  0.7903,
  0.8435,
  0.8936,
  0.9394,
  0.9761,
  1,
];
const ROBINSON_X_MAX = ROBINSON_FXC * Math.PI;
const ROBINSON_Y_MAX = ROBINSON_FYC;
const MAP_X_ALIGNMENT_SHIFT_PERCENT = -0.8;
const MAP_Y_ALIGNMENT_SHIFT_PERCENT = 3.8;
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 6;
const MIN_MARKER_SCREEN_SCALE = 0.7;

const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "request_failed");
  }
  return data;
};

const setMsg = (el, text) => {
  if (!el) return;
  el.textContent = text;
};

const escapeHtml = (text = "") =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const youtubeSearchUrl = (term = "") =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;

const buildChatgptTrainingPrompt = (topic = "") =>
  `you are an expert in ${topic}. You are to help me get better at it. I might ask you to chart a learning plan/give helpful questions for prepping/give me problems to solve/anything else an industry expert tutor can help me with. Don't reply with anything right now just say understood let's start learning ${topic}`;

const chatgptTrainingUrl = (topic = "") =>
  `https://chatgpt.com/?q=${encodeURIComponent(buildChatgptTrainingPrompt(topic))}`;

const buildKeypointPrompt = (jobLink = "") =>
  `You have to give linebreak separated tags related to the mentioned job link - ${jobLink}
I only want to see 10-20 important topics related to this job post listing. DON'T TYPE ANYTHING ELSE. Only topics which i can search on youtube and learn about which will help me in clearing the interviews for the job.`;

const updateGenerateTagsBtn = () => {
  if (!generateKeypointsBtn) return;
  const hasJobLink = Boolean(jobLinkInput?.value.trim());
  generateKeypointsBtn.classList.toggle("hidden", !hasJobLink);
};

const syncMobilePanel = () => {
  if (!addJobPanel) return;
  if (mobileAddMediaQuery.matches) {
    addJobPanel.classList.toggle("mobile-open", isMobilePanelOpen);
    const showingAdd = isMobilePanelOpen && activeLeftView === "add";
    const showingMap = isMobilePanelOpen && activeLeftView === "map";
    if (mobileAddToggleBtn) {
      mobileAddToggleBtn.textContent = showingAdd ? "Close add form" : "Add job";
      mobileAddToggleBtn.setAttribute("aria-expanded", String(showingAdd));
      mobileAddToggleBtn.classList.toggle("active", showingAdd);
    }
    if (mobileMapToggleBtn) {
      mobileMapToggleBtn.textContent = showingMap ? "Close map" : "Map";
      mobileMapToggleBtn.setAttribute("aria-expanded", String(showingMap));
      mobileMapToggleBtn.classList.toggle("active", showingMap);
    }
    if (showingMap) {
      window.requestAnimationFrame(() => {
        if (updateMapStageLayout()) {
          applyMapTransform();
        }
      });
    }
    return;
  }
  isMobilePanelOpen = false;
  addJobPanel.classList.remove("mobile-open");
  if (mobileAddToggleBtn) {
    mobileAddToggleBtn.textContent = "Add job";
    mobileAddToggleBtn.setAttribute("aria-expanded", "false");
    mobileAddToggleBtn.classList.remove("active");
  }
  if (mobileMapToggleBtn) {
    mobileMapToggleBtn.textContent = "Map";
    mobileMapToggleBtn.setAttribute("aria-expanded", "false");
    mobileMapToggleBtn.classList.remove("active");
  }
};

const setLeftView = (view) => {
  activeLeftView = view === "map" ? "map" : "add";
  const isMap = activeLeftView === "map";
  leftTabAddBtn?.classList.toggle("active", !isMap);
  leftTabMapBtn?.classList.toggle("active", isMap);
  leftTabAddBtn?.setAttribute("aria-selected", String(!isMap));
  leftTabMapBtn?.setAttribute("aria-selected", String(isMap));
  leftViewAdd?.classList.toggle("active", !isMap);
  leftViewMap?.classList.toggle("active", isMap);

  if (isMap) {
    if (mapSummary) {
      mapSummary.textContent = "Loading map...";
    }
    initFlatMap();
    if (updateMapStageLayout()) {
      applyMapTransform();
      updateFlatMapMarkers(latestJobs);
    } else {
      window.requestAnimationFrame(() => {
        if (updateMapStageLayout()) {
          applyMapTransform();
          updateFlatMapMarkers(latestJobs);
        }
      });
    }
  }
  syncMobilePanel();
};

const toggleMobilePanelView = (view) => {
  if (!mobileAddMediaQuery.matches) {
    setLeftView(view);
    return;
  }
  if (isMobilePanelOpen && activeLeftView === view) {
    isMobilePanelOpen = false;
    syncMobilePanel();
    return;
  }
  if (view === "map") {
    mapZoom = DEFAULT_MAP_ZOOM;
    mapPanX = 0;
    mapPanY = 0;
  }
  isMobilePanelOpen = true;
  syncMobilePanel();
  setLeftView(view);
};

const toTags = (text = "") =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeTagKey = (tag = "") => tag.trim().toLowerCase();
const normalizeCityKey = (city = "") => city.trim().toLowerCase();

const buildKeypointStatusMap = (items = []) => {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const tag = (item.tag || "").trim();
    if (!tag) return;
    const status = (item.status || "PENDING").toUpperCase() === "DONE" ? "DONE" : "PENDING";
    map.set(normalizeTagKey(tag), status);
  });
  return map;
};

const buildStatusesForTags = (tags = [], statusMap = new Map()) => {
  const seen = new Set();
  const statuses = [];
  tags.forEach((tag) => {
    const key = normalizeTagKey(tag);
    if (!key || seen.has(key)) return;
    seen.add(key);
    statuses.push({
      tag,
      status: statusMap.get(key) === "DONE" ? "DONE" : "PENDING",
    });
  });
  return statuses;
};

const getCardStatuses = (card) => {
  if (!card?.dataset?.keypointStatuses) return [];
  try {
    const parsed = JSON.parse(card.dataset.keypointStatuses);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setCardStatuses = (card, statuses = []) => {
  if (!card) return;
  card.dataset.keypointStatuses = JSON.stringify(statuses);
};

const renderTags = (tags = [], options = {}) => {
  const { statusMap = new Map(), interactive = false } = options;
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return uniqueTags.length
    ? `<div class="tag-list">${uniqueTags
        .map(
          (tag) => {
            const tagKey = normalizeTagKey(tag);
            const status = statusMap.get(tagKey) === "DONE" ? "DONE" : "PENDING";
            const doneClass = status === "DONE" ? "tag-done" : "";
            return `<span class="tag-split ${doneClass}" data-tag="${escapeHtml(tag)}">
              <a
                class="tag-icon tag-icon-youtube"
                href="${youtubeSearchUrl(tag)}"
                target="_blank"
                rel="noopener noreferrer"
                title="Learn on Youtube"
                aria-label="Learn on Youtube: ${escapeHtml(tag)}"
              >
                <svg class="tag-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 8L16 12L10 16V8Z" fill="currentColor"></path>
                </svg>
              </a>
              ${
                interactive
                  ? `<button type="button" class="tag-label-btn" data-tag="${escapeHtml(
                      tag
                    )}" title="Toggle status">${escapeHtml(tag)}</button>`
                  : `<span class="tag-label">${escapeHtml(tag)}</span>`
              }
              <a
                class="tag-icon tag-icon-chatgpt"
                href="${chatgptTrainingUrl(tag)}"
                target="_blank"
                rel="noopener noreferrer"
                title="Learn using ChatGPT"
                aria-label="Learn using ChatGPT: ${escapeHtml(tag)}"
              >
                <svg class="tag-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 6L13.6 10.4L18 12L13.6 13.6L12 18L10.4 13.6L6 12L10.4 10.4L12 6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
                </svg>
              </a>
            </span>`;
          }
        )
        .join("")}</div>`
    : `<p class="muted">No key points yet.</p>`;
};

const deriveConnectionName = (url = "") => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    let slug = "";
    const inIndex = segments.indexOf("in");
    const pubIndex = segments.indexOf("pub");
    if (inIndex !== -1 && segments[inIndex + 1]) {
      slug = segments[inIndex + 1];
    } else if (pubIndex !== -1 && segments[pubIndex + 1]) {
      slug = segments[pubIndex + 1];
    } else {
      slug = segments[segments.length - 1] || "";
    }
    if (!slug) return "";
    const tokens = slug
      .split(/[-_]+/)
      .map((t) => t.trim())
      .filter((t) => t && !/^\d+$/.test(t));
    if (!tokens.length) return "";
    return tokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(" ");
  } catch {
    return "";
  }
};

const formatUrl = (url = "") => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
};

const renderCityOptions = (cities = []) => {
  if (!cityOptions) return;
  cityLookup.clear();
  cityOptions.innerHTML = cities
    .map((city) => {
      const name = (city.name || "").trim();
      if (!name) return "";
      const latitude = Number(city.latitude);
      const longitude = Number(city.longitude);
      cityLookup.set(normalizeCityKey(name), { name, latitude, longitude });
      return `<option value="${escapeHtml(name)}"></option>`;
    })
    .join("");
};

const loadCities = async (query = "") => {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  params.set("limit", "80");
  const queryString = params.toString();
  const { cities } = await api(`/api/cities${queryString ? `?${queryString}` : ""}`);
  renderCityOptions(Array.isArray(cities) ? cities : []);
};

const getVisibleJobs = () => {
  if (!selectedCityKey) return latestJobs;
  return latestJobs.filter((job) => normalizeCityKey(job.city || job.location || "") === selectedCityKey);
};

const updateCityFilterUi = () => {
  if (!cityFilterLabel) return;
  if (!selectedCityKey) {
    cityFilterLabel.textContent = "";
    cityFilterLabel.classList.add("hidden");
    clearCityFilterBtn?.classList.add("hidden");
    return;
  }
  const cityJobs = getVisibleJobs();
  const label = selectedCityLabel || cityJobs[0]?.city || cityJobs[0]?.location || "Selected city";
  cityFilterLabel.textContent = `${label}: ${cityJobs.length} job${cityJobs.length === 1 ? "" : "s"}`;
  cityFilterLabel.classList.remove("hidden");
  clearCityFilterBtn?.classList.remove("hidden");
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const updateMapStageLayout = () => {
  if (!mapViewport || !mapStage) return false;
  const viewportWidth = mapViewport.clientWidth || 1;
  const viewportHeight = mapViewport.clientHeight || 1;
  if (viewportWidth <= 2 || viewportHeight <= 2) {
    return false;
  }
  const viewportRatio = viewportWidth / viewportHeight;
  if (viewportRatio >= MAP_ASPECT_RATIO) {
    mapStageHeight = viewportHeight;
    mapStageWidth = mapStageHeight * MAP_ASPECT_RATIO;
  } else {
    mapStageWidth = viewportWidth;
    mapStageHeight = mapStageWidth / MAP_ASPECT_RATIO;
  }
  mapStageLeft = (viewportWidth - mapStageWidth) / 2;
  mapStageTop = (viewportHeight - mapStageHeight) / 2;
  mapStage.style.width = `${mapStageWidth}px`;
  mapStage.style.height = `${mapStageHeight}px`;
  mapStage.style.left = `${mapStageLeft}px`;
  mapStage.style.top = `${mapStageTop}px`;
  return true;
};

const clampMapPan = () => {
  if (!mapViewport) return;
  const width = mapViewport.clientWidth || 1;
  const height = mapViewport.clientHeight || 1;
  const maxX = Math.max(0, (mapStageWidth * mapZoom - width) / 2);
  const maxY = Math.max(0, (mapStageHeight * mapZoom - height) / 2);
  mapPanX = clamp(mapPanX, -maxX, maxX);
  mapPanY = clamp(mapPanY, -maxY, maxY);
};

const markerScaleForZoom = () => {
  const zoomProgress = clamp((mapZoom - MIN_MAP_ZOOM) / (MAX_MAP_ZOOM - MIN_MAP_ZOOM), 0, 1);
  const targetScreenScale = 1 - (1 - MIN_MARKER_SCREEN_SCALE) * zoomProgress;
  return targetScreenScale / mapZoom;
};

const applyMapTransform = () => {
  if (!mapStage) return;
  clampMapPan();
  mapStage.style.setProperty("--marker-zoom-scale", `${markerScaleForZoom()}`);
  mapStage.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
};

const setMapZoom = (nextZoom, anchorClientX, anchorClientY) => {
  if (!mapViewport) return;
  const rect = mapViewport.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const anchorX = (anchorClientX ?? centerX) - centerX;
  const anchorY = (anchorClientY ?? centerY) - centerY;
  const clampedZoom = clamp(nextZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  if (Math.abs(clampedZoom - mapZoom) < 0.001) return;

  const worldX = (anchorX - mapPanX) / mapZoom;
  const worldY = (anchorY - mapPanY) / mapZoom;
  mapZoom = clampedZoom;
  mapPanX = anchorX - worldX * mapZoom;
  mapPanY = anchorY - worldY * mapZoom;
  applyMapTransform();
};

const initFlatMap = () => {
  if (isMapReady || !mapViewport || !mapStage || !mapMarkers) return;

  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".map-city-marker")) return;
    mapDragging = true;
    mapDidPan = false;
    mapLastX = event.clientX;
    mapLastY = event.clientY;
    mapStage.classList.add("dragging");
    mapViewport.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!mapDragging) return;
    const dx = event.clientX - mapLastX;
    const dy = event.clientY - mapLastY;
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      mapDidPan = true;
    }
    mapPanX += dx;
    mapPanY += dy;
    mapLastX = event.clientX;
    mapLastY = event.clientY;
    applyMapTransform();
  };

  const stopDrag = (event) => {
    if (!mapDragging) return;
    mapDragging = false;
    mapStage.classList.remove("dragging");
    mapViewport.releasePointerCapture?.(event.pointerId);
    window.setTimeout(() => {
      mapDidPan = false;
    }, 0);
  };

  const onWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.24 : -0.24;
    setMapZoom(mapZoom + delta, event.clientX, event.clientY);
  };

  mapViewport.addEventListener("pointerdown", onPointerDown);
  mapViewport.addEventListener("pointermove", onPointerMove);
  mapViewport.addEventListener("pointerup", stopDrag);
  mapViewport.addEventListener("pointercancel", stopDrag);
  mapViewport.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", () => {
    if (updateMapStageLayout()) {
      applyMapTransform();
    }
  });

  mapMarkers.addEventListener("click", (event) => {
    if (mapDidPan) return;
    const marker = event.target.closest(".map-city-marker");
    if (!marker?.dataset?.cityKey) return;
    selectedCityKey = marker.dataset.cityKey;
    selectedCityLabel = marker.dataset.cityLabel || "";
    updateCityFilterUi();
    renderJobs(getVisibleJobs());
    updateFlatMapMarkers(latestJobs);
  });

  mapZoomInBtn?.addEventListener("click", () => {
    setMapZoom(mapZoom + 0.36);
  });

  mapZoomOutBtn?.addEventListener("click", () => {
    setMapZoom(mapZoom - 0.36);
  });

  mapResetViewBtn?.addEventListener("click", () => {
    mapZoom = DEFAULT_MAP_ZOOM;
    mapPanX = 0;
    mapPanY = 0;
    applyMapTransform();
  });

  isMapReady = true;
  if (updateMapStageLayout()) {
    applyMapTransform();
  }
};

const clearFlatMapMarkers = () => {
  if (!mapMarkers) return;
  mapMarkers.innerHTML = "";
};

const latLonToMapPercent = (latitude, longitude) => {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  const lat = clamp(latitude, -90, 90);
  const lon = ((((longitude + 180) % 360) + 360) % 360) - 180;

  const absLat = Math.abs(lat);
  const maxIndex = ROBINSON_X.length - 1;
  const band = Math.min(Math.floor(absLat / ROBINSON_LAT_STEP), maxIndex - 1);
  const bandStart = band * ROBINSON_LAT_STEP;
  const t = (absLat - bandStart) / ROBINSON_LAT_STEP;
  const xCoef = ROBINSON_X[band] + (ROBINSON_X[band + 1] - ROBINSON_X[band]) * t;
  const yCoef = ROBINSON_Y[band] + (ROBINSON_Y[band + 1] - ROBINSON_Y[band]) * t;

  const lambda = (lon * Math.PI) / 180;
  const xRobinson = ROBINSON_FXC * lambda * xCoef;
  const yRobinson = ROBINSON_FYC * yCoef * (lat < 0 ? -1 : 1);

  const xPercent =
    ((xRobinson + ROBINSON_X_MAX) / (2 * ROBINSON_X_MAX)) * 100 + MAP_X_ALIGNMENT_SHIFT_PERCENT;
  const yPercent =
    ((ROBINSON_Y_MAX - yRobinson) / (2 * ROBINSON_Y_MAX)) * 100 + MAP_Y_ALIGNMENT_SHIFT_PERCENT;
  return { x: clamp(xPercent, 0, 100), y: clamp(yPercent, 0, 100) };
};

const updateFlatMapMarkers = (jobs = []) => {
  if (!mapViewport || !mapMarkers) return;
  initFlatMap();

  clearFlatMapMarkers();
  const grouped = new Map();
  (jobs || []).forEach((job) => {
    const city = (job.city || job.location || "").trim();
    const latitude = Number(job.city_latitude);
    const longitude = Number(job.city_longitude);
    if (!city || Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    const key = normalizeCityKey(city);
    const prev = grouped.get(key);
    if (prev) {
      prev.count += 1;
      return;
    }
    grouped.set(key, { city, latitude, longitude, count: 1 });
  });

  grouped.forEach(({ city, latitude, longitude, count }, key) => {
    const position = latLonToMapPercent(latitude, longitude);
    if (!position) return;

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "map-city-marker";
    if (count > 1) marker.classList.add("multi");
    if (key === selectedCityKey) marker.classList.add("active");
    marker.style.left = `${position.x}%`;
    marker.style.top = `${position.y}%`;
    marker.style.setProperty("--marker-size", `${Math.min(22, 10 + count * 2)}px`);
    marker.dataset.cityKey = key;
    marker.dataset.cityLabel = city;
    marker.dataset.count = String(count);
    marker.setAttribute("aria-label", `${city}: ${count} job${count === 1 ? "" : "s"}`);
    marker.title = `${city}: ${count} job${count === 1 ? "" : "s"}`;
    mapMarkers.appendChild(marker);
  });

  if (!mapSummary) return;
  const total = grouped.size;
  const markerJobs = [...grouped.values()].reduce((sum, item) => sum + item.count, 0);
  mapSummary.textContent = total
    ? `${markerJobs} job${markerJobs === 1 ? "" : "s"} across ${total} cit${total === 1 ? "y" : "ies"}`
    : "No city markers yet.";
};

const renderJobs = (jobs = []) => {
  if (!jobsContainer) return;
  if (!jobs.length) {
    jobsContainer.innerHTML = "<p class=\"muted\">No jobs yet. Add your first role.</p>";
    return;
  }

  jobsContainer.innerHTML = jobs
    .map((job) => {
      const isExpanded = expandedJobIds.has(String(job.id));
      const connections = job.connections || [];
      const keypointStatusMap = buildKeypointStatusMap(job.keypoint_statuses || []);
      const tags = toTags(job.keypoints || "");
      const statuses = buildStatusesForTags(tags, keypointStatusMap);
      const connectionsHtml = connections.length
        ? `<div class="connection-grid">${connections
            .map(
              (c) => {
                const name = c.name || deriveConnectionName(c.url) || "LinkedIn profile";
                const urlLabel = formatUrl(c.url);
                return `
              <div class="connection-card ${c.status === "REFERRED" ? "connection-referred" : ""}" data-connection-id="${c.id}">
                <div class="connection-top">
                  <span class="connection-label">LinkedIn</span>
                  <select class="connection-status">
                    ${["PENDING", "MESSAGED", "REFERRED"]
                      .map(
                        (status) =>
                          `<option ${status === c.status ? "selected" : ""}>${status}</option>`
                      )
                      .join("")}
                  </select>
                  <div class="connection-actions">
                    <button class="update-connection">Save</button>
                    <button class="remove-connection ghost">Remove</button>
                  </div>
                </div>
                <div class="connection-main">
                  <a class="connection-name" href="${c.url}" target="_blank" rel="noopener">${name}</a>
                  <span class="connection-url">${urlLabel}</span>
                </div>
              </div>`;
              }
            )
            .join("")}</div>`
        : "<p class=\"muted\">No connections yet.</p>";

      const statusClass = `status-${(job.status || "").toLowerCase()}`;
      return `
        <div class="job-card ${isExpanded ? "" : "collapsed"} ${statusClass}" data-id="${
        job.id
      }" data-keypoint-statuses='${escapeHtml(JSON.stringify(statuses))}'>
          <div class="job-head">
            <button class="collapse-toggle" aria-expanded="${isExpanded ? "true" : "false"}">${
        isExpanded ? "−" : "+"
      }</button>
            <div>
              <h4>${job.title || "Untitled role"}</h4>
              <a class="job-link" href="${job.link}" target="_blank" rel="noopener">${job.link}</a>
              <div class="job-meta">
                <span>Status: ${job.status}</span>
                ${job.yoe ? `<span>YoE: ${job.yoe}</span>` : ""}
                ${job.location ? `<span>City: ${job.location}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="job-body ${isExpanded ? "" : "hidden"}">
            <div class="job-section">
              <label>Job title</label>
              <input type="text" class="title-input" value="${job.title || ""}" />
              <button class="update-title">Save title</button>
            </div>
            <div class="job-section">
              <label>Status</label>
              <select class="status-select">
                ${["INTERESTED", "APPLIED", "ONGOING", "ACCEPTED", "REJECTED"]
                  .map(
                    (status) =>
                      `<option ${status === job.status ? "selected" : ""}>${status}</option>`
                  )
                  .join("")}
              </select>
              <button class="update-status">Update status</button>
            </div>
            <div class="job-tabs">
              <button class="tab-btn active" data-tab="keypoints">Key points</button>
              <button class="tab-btn" data-tab="resume">Resume</button>
              <button class="tab-btn" data-tab="linkedin">LinkedIn</button>
            </div>
            <div class="tab-panel active" data-tab="keypoints">
              <div class="job-section">
                <label>Key points</label>
                <textarea class="keypoints" rows="3">${job.keypoints || ""}</textarea>
                <div class="tag-area">
                  ${renderTags(tags, { statusMap: buildKeypointStatusMap(statuses), interactive: true })}
                </div>
                <button class="update-keypoints">Save key points</button>
              </div>
            </div>
            <div class="tab-panel" data-tab="resume">
              <div class="job-section">
                <label>Overleaf project link</label>
                <input type="url" class="overleaf-link" value="${job.overleaf_link || ""}" placeholder="https://www.overleaf.com/project/..." />
                <button class="save-overleaf">Save link</button>
                ${
                  job.overleaf_link
                    ? `<a class="overleaf-link-display" href="${job.overleaf_link}" target="_blank" rel="noopener">Open Overleaf project</a>`
                    : ""
                }
              </div>
            </div>
            <div class="tab-panel" data-tab="linkedin">
              <div class="job-section">
                <label>Add LinkedIn connection</label>
                <input type="url" class="connection-url" placeholder="https://linkedin.com/in/..." />
                <button class="add-connection">Add connection</button>
                ${connectionsHtml}
              </div>
            </div>
            <div class="job-section">
              <button class="delete-job ghost">Delete job</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

const loadJobs = async () => {
  if (jobsContainer) {
    const cards = jobsContainer.querySelectorAll(".job-card");
    expandedJobIds.clear();
    cards.forEach((card) => {
      const body = card.querySelector(".job-body");
      if (body && !body.classList.contains("hidden")) {
        expandedJobIds.add(card.dataset.id);
      }
    });
  }
  const { jobs } = await api("/api/jobs");
  latestJobs = Array.isArray(jobs) ? jobs : [];
  if (selectedCityKey) {
    const stillExists = latestJobs.some(
      (job) => normalizeCityKey(job.city || job.location || "") === selectedCityKey
    );
    if (!stillExists) {
      selectedCityKey = "";
      selectedCityLabel = "";
    } else if (!selectedCityLabel) {
      selectedCityLabel =
        latestJobs.find((job) => normalizeCityKey(job.city || job.location || "") === selectedCityKey)
          ?.city || "";
    }
  }
  updateCityFilterUi();
  renderJobs(getVisibleJobs());
  if (activeLeftView === "map") {
    updateFlatMapMarkers(latestJobs);
  }
};

const handleAuth = async (type, form) => {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  setMsg(authMsg, "");

  try {
    await api(`/api/${type}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMsg(authMsg, type === "login" ? "Logged in." : "Account created. Login now.");
    if (type === "login") {
      dashboard.classList.remove("hidden");
      authPanel?.classList.add("hidden");
      hero?.classList.add("hidden");
      await loadCities();
      await loadJobs();
    }
  } catch (err) {
    setMsg(authMsg, err.message.replace(/_/g, " "));
  }
};

const init = async () => {
  try {
    const me = await api("/api/me");
    if (me.authenticated) {
      dashboard.classList.remove("hidden");
      authPanel?.classList.add("hidden");
      hero?.classList.add("hidden");
      await loadCities();
      await loadJobs();
    }
  } catch (err) {
    console.error(err);
  }
};

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAuth("login", loginForm);
});

registerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAuth("register", registerForm);
});

jobForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(jobForm);
  const payload = Object.fromEntries(formData.entries());
  const city = (payload.city || "").trim();
  setMsg(jobMsg, "");

  if (city) {
    if (!cityLookup.has(normalizeCityKey(city))) {
      await loadCities(city);
    }
    const matchedCity = cityLookup.get(normalizeCityKey(city));
    if (!matchedCity) {
      setMsg(jobMsg, "city not found in fixed city list");
      return;
    }
    payload.city = matchedCity.name;
  }

  try {
    await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    jobForm.reset();
    if (jobKeypointsTags) {
      jobKeypointsTags.innerHTML = renderTags([]);
    }
    if (cityInput) {
      cityInput.value = "";
    }
    if (mobileAddMediaQuery.matches) {
      isMobilePanelOpen = false;
      syncMobilePanel();
    }
    updateGenerateTagsBtn();
    await loadJobs();
    setMsg(jobMsg, "Job added.");
  } catch (err) {
    setMsg(jobMsg, err.message.replace(/_/g, " "));
  }
});

jobKeypointsInput?.addEventListener("input", () => {
  if (!jobKeypointsTags) return;
  jobKeypointsTags.innerHTML = renderTags(toTags(jobKeypointsInput.value));
});

jobLinkInput?.addEventListener("input", updateGenerateTagsBtn);

generateKeypointsBtn?.addEventListener("click", () => {
  const jobLink = jobLinkInput?.value.trim();
  if (!jobLink) return;
  const prompt = buildKeypointPrompt(jobLink);
  const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

const queueCitySearch = (value = "") => {
  if (citySearchDebounce) {
    window.clearTimeout(citySearchDebounce);
  }
  citySearchDebounce = window.setTimeout(() => {
    loadCities(value).catch((err) => {
      setMsg(jobMsg, err.message.replace(/_/g, " "));
    });
  }, 120);
};

cityInput?.addEventListener("focus", () => {
  queueCitySearch(cityInput.value);
});

cityInput?.addEventListener("input", () => {
  queueCitySearch(cityInput.value);
});

cityInput?.addEventListener("change", () => {
  const city = cityInput.value.trim();
  if (!city) return;
  const found = cityLookup.get(normalizeCityKey(city));
  if (found) {
    cityInput.value = found.name;
  }
});

leftTabAddBtn?.addEventListener("click", () => {
  setLeftView("add");
});

leftTabMapBtn?.addEventListener("click", () => {
  setLeftView("map");
});

clearCityFilterBtn?.addEventListener("click", () => {
  selectedCityKey = "";
  selectedCityLabel = "";
  updateCityFilterUi();
  renderJobs(getVisibleJobs());
  if (activeLeftView === "map") {
    updateFlatMapMarkers(latestJobs);
  }
});

mobileAddToggleBtn?.addEventListener("click", () => {
  toggleMobilePanelView("add");
});

mobileMapToggleBtn?.addEventListener("click", () => {
  toggleMobilePanelView("map");
});

mobileAddMediaQuery.addEventListener("change", syncMobilePanel);

jobsContainer?.addEventListener("click", async (event) => {
  const card = event.target.closest(".job-card");
  if (!card) return;
  const jobId = card.dataset.id;

  if (event.target.classList.contains("collapse-toggle")) {
    const body = card.querySelector(".job-body");
    if (!body) return;
    const isHidden = body.classList.contains("hidden");
    body.classList.toggle("hidden");
    event.target.textContent = isHidden ? "−" : "+";
    event.target.setAttribute("aria-expanded", String(isHidden));
    card.classList.toggle("collapsed", !isHidden);
    if (isHidden) {
      expandedJobIds.add(jobId);
    } else {
      expandedJobIds.delete(jobId);
    }
    return;
  }

  if (event.target.classList.contains("tab-btn")) {
    const tab = event.target.dataset.tab;
    if (!tab) return;
    card.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    card.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tab === tab);
    });
    return;
  }

  if (event.target.classList.contains("update-status")) {
    const status = card.querySelector(".status-select")?.value;
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("update-title")) {
    const title = card.querySelector(".title-input")?.value;
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("update-keypoints")) {
    const keypoints = card.querySelector(".keypoints")?.value;
    const tags = toTags(keypoints || "");
    const statusMap = buildKeypointStatusMap(getCardStatuses(card));
    const keypoint_statuses = buildStatusesForTags(tags, statusMap);
    setCardStatuses(card, keypoint_statuses);
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ keypoints, keypoint_statuses }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("tag-label-btn")) {
    const tag = (event.target.dataset.tag || "").trim();
    if (!tag) return;
    const textarea = card.querySelector(".keypoints");
    const tags = toTags(textarea?.value || "");
    const statusMap = buildKeypointStatusMap(getCardStatuses(card));
    const tagKey = normalizeTagKey(tag);
    statusMap.set(tagKey, statusMap.get(tagKey) === "DONE" ? "PENDING" : "DONE");
    const keypoint_statuses = buildStatusesForTags(tags, statusMap);
    setCardStatuses(card, keypoint_statuses);
    const tagArea = card.querySelector(".tag-area");
    if (tagArea) {
      tagArea.innerHTML = renderTags(tags, {
        statusMap: buildKeypointStatusMap(keypoint_statuses),
        interactive: true,
      });
    }
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ keypoint_statuses }),
    });
  }

  if (event.target.classList.contains("save-overleaf")) {
    const overleaf_link = card.querySelector(".overleaf-link")?.value;
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ overleaf_link }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("add-connection")) {
    const url = card.querySelector(".connection-url")?.value;
    await api(`/api/jobs/${jobId}/connections`, {
      method: "POST",
      body: JSON.stringify({ url, status: "PENDING" }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("update-connection")) {
    const connectionCard = event.target.closest(".connection-card");
    if (!connectionCard) return;
    const connectionId = connectionCard.dataset.connectionId;
    const status = connectionCard.querySelector(".connection-status")?.value;
    await api(`/api/connections/${connectionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("remove-connection")) {
    const connectionCard = event.target.closest(".connection-card");
    if (!connectionCard) return;
    const connectionId = connectionCard.dataset.connectionId;
    await api(`/api/connections/${connectionId}`, {
      method: "DELETE",
    });
    await loadJobs();
  }

  if (event.target.classList.contains("delete-job")) {
    const shouldDelete = window.confirm("Delete this job and its LinkedIn connections?");
    if (!shouldDelete) return;
    await api(`/api/jobs/${jobId}`, {
      method: "DELETE",
    });
    expandedJobIds.delete(jobId);
    await loadJobs();
  }
});

jobsContainer?.addEventListener("input", (event) => {
  if (!event.target.classList.contains("keypoints")) return;
  const card = event.target.closest(".job-card");
  if (!card) return;
  const tagArea = card.querySelector(".tag-area");
  if (!tagArea) return;
  const tags = toTags(event.target.value);
  const statusMap = buildKeypointStatusMap(getCardStatuses(card));
  const statuses = buildStatusesForTags(tags, statusMap);
  setCardStatuses(card, statuses);
  tagArea.innerHTML = renderTags(tags, { statusMap: buildKeypointStatusMap(statuses), interactive: true });
});

logoutBtn?.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  dashboard.classList.add("hidden");
  authPanel?.classList.remove("hidden");
  hero?.classList.remove("hidden");
  if (citySearchDebounce) {
    window.clearTimeout(citySearchDebounce);
    citySearchDebounce = null;
  }
  cityLookup.clear();
  if (cityOptions) cityOptions.innerHTML = "";
  latestJobs = [];
  selectedCityKey = "";
  selectedCityLabel = "";
  updateCityFilterUi();
  renderJobs([]);
  if (isMapReady) {
    updateFlatMapMarkers([]);
  }
  isMobilePanelOpen = false;
  syncMobilePanel();
  setMsg(authMsg, "Logged out.");
});

let hasBootstrapped = false;
const bootstrapApp = () => {
  if (hasBootstrapped) return;
  hasBootstrapped = true;
  setLeftView("add");
  init();
  updateGenerateTagsBtn();
  syncMobilePanel();
};

bootstrapApp();
