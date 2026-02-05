const authMsg = document.getElementById("auth-msg");
const jobMsg = document.getElementById("job-msg");
const dashboard = document.getElementById("dashboard");
const jobsContainer = document.getElementById("jobs");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const jobForm = document.getElementById("job-form");
const logoutBtn = document.getElementById("logout-btn");
const authPanel = document.getElementById("auth-panel");
const hero = document.getElementById("hero");
const expandedJobIds = new Set();
const jobKeypointsInput = document.querySelector("#job-form textarea[name=\"keypoints\"]");
const jobKeypointsTags = document.getElementById("job-keypoints-tags");

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

const toTags = (text = "") =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const renderTags = (tags = []) =>
  tags.length
    ? `<div class="tag-list">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`
    : `<p class="muted">No key points yet.</p>`;

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
      const connectionsHtml = connections.length
        ? `<div class="connection-grid">${connections
            .map(
              (c) => `
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
                <a href="${c.url}" target="_blank" rel="noopener">${c.url}</a>
              </div>`
            )
            .join("")}</div>`
        : "<p class=\"muted\">No connections yet.</p>";

      const statusClass = `status-${(job.status || "").toLowerCase()}`;
      return `
        <div class="job-card ${isExpanded ? "" : "collapsed"} ${statusClass}" data-id="${job.id}">
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
                ${job.location ? `<span>Location: ${job.location}</span>` : ""}
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
                  ${renderTags(toTags(job.keypoints || ""))}
                </div>
                <button class="update-keypoints">Save key points</button>
              </div>
            </div>
            <div class="tab-panel" data-tab="resume">
              <div class="job-section">
                <label>Resume (.tex)</label>
                <textarea class="resume" rows="5">${job.resume_tex || ""}</textarea>
                <button class="save-resume">Save resume</button>
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
  renderJobs(jobs);
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
  setMsg(jobMsg, "");

  try {
    await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    jobForm.reset();
    if (jobKeypointsTags) {
      jobKeypointsTags.innerHTML = renderTags([]);
    }
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
    await api(`/api/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ keypoints }),
    });
    await loadJobs();
  }

  if (event.target.classList.contains("save-resume")) {
    const resume_tex = card.querySelector(".resume")?.value;
    await api(`/api/jobs/${jobId}/resume`, {
      method: "POST",
      body: JSON.stringify({ resume_tex }),
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
});

jobsContainer?.addEventListener("input", (event) => {
  if (!event.target.classList.contains("keypoints")) return;
  const card = event.target.closest(".job-card");
  if (!card) return;
  const tagArea = card.querySelector(".tag-area");
  if (!tagArea) return;
  tagArea.innerHTML = renderTags(toTags(event.target.value));
});

logoutBtn?.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  dashboard.classList.add("hidden");
  authPanel?.classList.remove("hidden");
  hero?.classList.remove("hidden");
  setMsg(authMsg, "Logged out.");
});

init();
