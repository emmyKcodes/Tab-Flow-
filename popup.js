let groups = [];
let aiEnabled = true;
let viewMode = "cards";

document.addEventListener("DOMContentLoaded", async () => {
  await loadGroups();
  setupEventListeners();
  renderGroups();
  generateAISuggestions();
});

async function loadGroups() {
  const result = await chrome.storage.local.get(["groups"]);
  if (result.groups && result.groups.length > 0) {
    groups = result.groups;
  } else {
    await createInitialGroups();
  }
}

async function saveGroups() {
  await chrome.storage.local.set({ groups });
}

async function createInitialGroups() {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  if (tabs.length === 0) return;

  const domainGroups = {};

  tabs.forEach((tab) => {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.replace("www.", "");

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl || "fas fa-globe",
        lastVisited: Date.now(),
        visitCount: 1,
      });
    } catch (e) {}
  });

  const colors = [
    "#8b5a3c",
    "#6d4226",
    "#a0826d",
    "#5c3d2e",
    "#b8956a",
    "#8b6f47",
  ];
  let colorIndex = 0;

  Object.entries(domainGroups).forEach(([domain, tabs]) => {
    if (tabs.length > 0) {
      const domainName = domain.split(".")[0];
      groups.push({
        id: Date.now() + Math.random(),
        name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
        color: colors[colorIndex % colors.length],
        tabs: tabs,
        collapsed: false,
        theme: "gradient",
        icon: getIconForDomain(domain),
      });
      colorIndex++;
    }
  });

  await saveGroups();
}

function getIconForDomain(domain) {
  const iconMap = {
    gmail: "fa-envelope",
    mail: "fa-envelope",
    google: "fa-google",
    docs: "fa-file-alt",
    drive: "fa-folder",
    youtube: "fa-youtube",
    github: "fa-github",
    stackoverflow: "fa-stack-overflow",
    twitter: "fa-twitter",
    facebook: "fa-facebook",
    linkedin: "fa-linkedin",
    reddit: "fa-reddit",
    amazon: "fa-amazon",
    netflix: "fa-film",
    spotify: "fa-spotify",
    slack: "fa-slack",
  };

  for (const [key, icon] of Object.entries(iconMap)) {
    if (domain.includes(key)) {
      return icon;
    }
  }

  return "fa-folder";
}

function setupEventListeners() {
  document
    .getElementById("newGroupBtn")
    .addEventListener("click", createNewGroup);
  document
    .getElementById("createFirstGroup")
    ?.addEventListener("click", createNewGroup);
  document.getElementById("aiToggleBtn").addEventListener("click", toggleAI);
  document
    .getElementById("viewModeBtn")
    .addEventListener("click", toggleViewMode);
}

async function createNewGroup() {
  const colors = [
    "#8b5a3c",
    "#6d4226",
    "#a0826d",
    "#5c3d2e",
    "#b8956a",
    "#8b6f47",
  ];
  const newGroup = {
    id: Date.now(),
    name: "New Group",
    color: colors[Math.floor(Math.random() * colors.length)],
    tabs: [],
    collapsed: false,
    theme: "gradient",
    icon: "fa-folder",
  };

  groups.push(newGroup);
  await saveGroups();
  renderGroups();
}

function toggleAI() {
  aiEnabled = !aiEnabled;
  const panel = document.getElementById("aiPanel");
  const btn = document.getElementById("aiToggleBtn");

  panel.style.display = aiEnabled ? "block" : "none";

  if (aiEnabled) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
}

function toggleViewMode() {
  viewMode = viewMode === "cards" ? "list" : "cards";
  const icon = document.getElementById("viewIcon");
  icon.className = viewMode === "cards" ? "fas fa-th" : "fas fa-list";
  renderGroups();
}

function renderGroups() {
  const container = document.getElementById("groupsContainer");
  const emptyState = document.getElementById("emptyState");

  if (groups.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  container.innerHTML = groups.map((group) => createGroupCard(group)).join("");

  groups.forEach((group) => {
    const card = document.querySelector(`[data-group-id="${group.id}"]`);
    if (card) {
      card
        .querySelector(".group-header")
        .addEventListener("click", () => toggleGroup(group.id));
      card.querySelector(".delete-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteGroup(group.id);
      });

      group.tabs.forEach((tab) => {
        const tabEl = card.querySelector(`[data-tab-id="${tab.id}"]`);
        if (tabEl) {
          tabEl.addEventListener("click", () => openTab(tab));
        }
      });
    }
  });
}

function createGroupCard(group) {
  const themeStyle = getThemeStyle(group.theme, group.color);

  return `
    <div class="group-card ${group.collapsed ? "collapsed" : ""}" 
         data-group-id="${group.id}"
         style="${themeStyle}">
      <div class="group-header">
        <div class="group-info">
          <div class="group-icon"><i class="fas ${group.icon}"></i></div>
          <div class="group-name">${group.name}</div>
          <div class="tab-count">
            <i class="fas fa-layer-group"></i> ${group.tabs.length}
          </div>
        </div>
        <div class="group-actions">
          <button class="delete-btn" title="Delete group">
            <i class="fas fa-trash"></i>
          </button>
          <button class="collapse-btn">
            <i class="fas fa-chevron-${group.collapsed ? "right" : "down"}"></i>
          </button>
        </div>
      </div>
      <div class="tabs-list">
        ${group.tabs.map((tab) => createTabItem(tab)).join("")}
      </div>
    </div>
  `;
}

function createTabItem(tab) {
  const priority = getTabPriority(tab);
  const priorityClass = `priority-${priority}`;
  const priorityIcons = {
    high: "fa-fire",
    active: "fa-circle",
    stale: "fa-clock",
    normal: "fa-minus",
  };

  const favicon =
    typeof tab.favicon === "string" && tab.favicon.startsWith("http")
      ? `<img src="${tab.favicon}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
       <i class="fas fa-globe" style="display:none;"></i>`
      : `<i class="fas ${tab.favicon}"></i>`;

  const timeSince = getTimeSince(tab.lastVisited);

  return `
    <div class="tab-item" data-tab-id="${tab.id}">
      <div class="tab-favicon">${favicon}</div>
      <div class="tab-info">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-meta">
          <span class="priority-badge ${priorityClass}">
            <i class="fas ${priorityIcons[priority]}"></i> ${priority}
          </span>
          <i class="fas fa-eye"></i> ${tab.visitCount}
          <i class="fas fa-clock"></i> ${timeSince}
        </div>
      </div>
    </div>
  `;
}

function getTimeSince(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getThemeStyle(theme, color) {
  const styles = {
    gradient: `background: linear-gradient(135deg, ${color}30 0%, ${color}50 100%); border: 2px solid ${color}80;`,
    solid: `background: ${color}20; border: 2px solid ${color};`,
    glass: `background: ${color}15; backdrop-filter: blur(10px); border: 1px solid ${color}60;`,
  };
  return styles[theme] || styles.gradient;
}

function getTabPriority(tab) {
  const hoursSinceVisit = (Date.now() - tab.lastVisited) / 3600000;
  if (tab.visitCount > 50) return "high";
  if (hoursSinceVisit < 1) return "active";
  if (hoursSinceVisit > 24) return "stale";
  return "normal";
}

async function toggleGroup(groupId) {
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.collapsed = !group.collapsed;
    await saveGroups();
    renderGroups();
  }
}

async function deleteGroup(groupId) {
  if (confirm("Delete this group? Tabs will remain open.")) {
    groups = groups.filter((g) => g.id !== groupId);
    await saveGroups();
    renderGroups();
    generateAISuggestions();
  }
}

async function openTab(tab) {
  try {
    const existingTabs = await chrome.tabs.query({ url: tab.url });
    if (existingTabs.length > 0) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: tab.url });
    }

    const group = groups.find((g) => g.tabs.some((t) => t.id === tab.id));
    if (group) {
      const tabObj = group.tabs.find((t) => t.id === tab.id);
      if (tabObj) {
        tabObj.lastVisited = Date.now();
        tabObj.visitCount++;
        await saveGroups();
      }
    }
  } catch (error) {
    console.error("Error opening tab:", error);
  }
}

function generateAISuggestions() {
  const suggestions = document.getElementById("suggestions");
  const aiSuggestions = [];

  const domainCounts = {};
  groups.forEach((group) => {
    group.tabs.forEach((tab) => {
      try {
        const domain = new URL(tab.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {}
    });
  });

  const duplicateDomains = Object.entries(domainCounts).filter(
    ([_, count]) => count > 1
  );
  if (duplicateDomains.length > 0) {
    aiSuggestions.push({
      icon: "fa-object-group",
      text: `Merge ${duplicateDomains.length} groups with duplicate domains`,
      action: "merge-domains",
    });
  }

  const staleTabs = groups.reduce((count, group) => {
    return (
      count +
      group.tabs.filter((tab) => {
        const hours = (Date.now() - tab.lastVisited) / 3600000;
        return hours > 24;
      }).length
    );
  }, 0);

  if (staleTabs > 0) {
    aiSuggestions.push({
      icon: "fa-archive",
      text: `Archive ${staleTabs} tabs inactive for 24+ hours`,
      action: "archive-stale",
    });
  }

  chrome.tabs.query({ currentWindow: true }).then((allTabs) => {
    const groupedTabIds = groups.flatMap((g) => g.tabs.map((t) => t.id));
    const ungroupedCount = allTabs.filter(
      (t) => !groupedTabIds.includes(t.id)
    ).length;

    if (ungroupedCount > 5) {
      aiSuggestions.push({
        icon: "fa-layer-group",
        text: `Group ${ungroupedCount} ungrouped tabs automatically`,
        action: "auto-group",
      });
    }

    renderSuggestions(aiSuggestions);
  });
}

function renderSuggestions(aiSuggestions) {
  const container = document.getElementById("suggestions");

  if (aiSuggestions.length === 0) {
    container.innerHTML = `
      <div class="suggestion">
        <div class="suggestion-text">
          <i class="fas fa-check-circle suggestion-icon"></i>
          Everything looks optimized!
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = aiSuggestions
    .map(
      (suggestion) => `
    <div class="suggestion">
      <div class="suggestion-text">
        <i class="fas ${suggestion.icon} suggestion-icon"></i>
        ${suggestion.text}
      </div>
      <button class="suggestion-action" data-action="${suggestion.action}">
        Apply
      </button>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".suggestion-action").forEach((btn) => {
    btn.addEventListener("click", () => handleAISuggestion(btn.dataset.action));
  });
}

async function handleAISuggestion(action) {
  switch (action) {
    case "merge-domains":
      await mergeDuplicateDomains();
      break;
    case "archive-stale":
      await archiveStaleTabs();
      break;
    case "auto-group":
      await autoGroupTabs();
      break;
  }

  await saveGroups();
  renderGroups();
  generateAISuggestions();
}

async function mergeDuplicateDomains() {
  const domainGroups = {};

  groups.forEach((group) => {
    group.tabs.forEach((tab) => {
      try {
        const domain = new URL(tab.url).hostname;
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push({ group, tab });
      } catch (e) {}
    });
  });

  for (const [domain, items] of Object.entries(domainGroups)) {
    if (items.length > 1) {
      const uniqueGroups = [...new Set(items.map((item) => item.group))];
      if (uniqueGroups.length > 1) {
        const targetGroup = uniqueGroups[0];
        const otherGroups = uniqueGroups.slice(1);

        otherGroups.forEach((group) => {
          const domainTabs = group.tabs.filter((tab) => {
            try {
              return new URL(tab.url).hostname === domain;
            } catch (e) {
              return false;
            }
          });

          targetGroup.tabs.push(...domainTabs);
          group.tabs = group.tabs.filter((tab) => !domainTabs.includes(tab));
        });
      }
    }
  }

  groups = groups.filter((g) => g.tabs.length > 0);
}

async function archiveStaleTabs() {
  let archivedGroup = groups.find((g) => g.name === "Archived");

  if (!archivedGroup) {
    archivedGroup = {
      id: Date.now(),
      name: "Archived",
      color: "#8b6f47",
      tabs: [],
      collapsed: true,
      theme: "gradient",
      icon: "fa-archive",
    };
    groups.push(archivedGroup);
  }

  groups.forEach((group) => {
    if (group !== archivedGroup) {
      const staleTabs = group.tabs.filter((tab) => {
        const hours = (Date.now() - tab.lastVisited) / 3600000;
        return hours > 24;
      });

      archivedGroup.tabs.push(...staleTabs);
      group.tabs = group.tabs.filter((tab) => !staleTabs.includes(tab));
    }
  });

  groups = groups.filter((g) => g.tabs.length > 0);
}

async function autoGroupTabs() {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const groupedTabIds = groups.flatMap((g) => g.tabs.map((t) => t.id));
  const ungroupedTabs = allTabs.filter((t) => !groupedTabIds.includes(t.id));

  if (ungroupedTabs.length === 0) return;

  const domainGroups = {};

  ungroupedTabs.forEach((tab) => {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.replace("www.", "");

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl || "fas fa-globe",
        lastVisited: Date.now(),
        visitCount: 1,
      });
    } catch (e) {}
  });

  const colors = [
    "#8b5a3c",
    "#6d4226",
    "#a0826d",
    "#5c3d2e",
    "#b8956a",
    "#8b6f47",
  ];

  Object.entries(domainGroups).forEach(([domain, tabs], index) => {
    if (tabs.length > 0) {
      const existingGroup = groups.find((g) =>
        g.tabs.some((t) => {
          try {
            return new URL(t.url).hostname.includes(domain);
          } catch (e) {
            return false;
          }
        })
      );

      if (existingGroup) {
        existingGroup.tabs.push(...tabs);
      } else {
        const domainName = domain.split(".")[0];
        groups.push({
          id: Date.now() + Math.random(),
          name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
          color: colors[index % colors.length],
          tabs: tabs,
          collapsed: false,
          theme: "gradient",
          icon: getIconForDomain(domain),
        });
      }
    }
  });
}
