// TabFlow Background Service Worker

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("TabFlow installed! Welcome!");

    // Set default settings
    await chrome.storage.local.set({
      groups: [],
      settings: {
        autoGroup: true,
        aiEnabled: true,
        theme: "coffee-brown",
      },
    });

    // Open welcome page
    chrome.tabs.create({
      url: "https://github.com/yourusername/tabflow-extension",
    });
  }
});

// Listen for tab updates to track activity
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await updateTabActivity(tabId, tab);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await updateTabActivity(activeInfo.tabId, tab);
});

// Update tab activity in storage
async function updateTabActivity(tabId, tab) {
  try {
    const result = await chrome.storage.local.get(["groups"]);
    const groups = result.groups || [];

    let updated = false;

    groups.forEach((group) => {
      const tabIndex = group.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex !== -1) {
        group.tabs[tabIndex].lastVisited = Date.now();
        group.tabs[tabIndex].visitCount =
          (group.tabs[tabIndex].visitCount || 0) + 1;
        group.tabs[tabIndex].title = tab.title;
        group.tabs[tabIndex].url = tab.url;
        group.tabs[tabIndex].favicon = tab.favIconUrl || "fas fa-globe";
        updated = true;
      }
    });

    if (updated) {
      await chrome.storage.local.set({ groups });
    }
  } catch (error) {
    console.error("Error updating tab activity:", error);
  }
}

// Listen for tab removals to clean up storage
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const result = await chrome.storage.local.get(["groups"]);
    const groups = result.groups || [];

    let updated = false;

    groups.forEach((group) => {
      const initialLength = group.tabs.length;
      group.tabs = group.tabs.filter((t) => t.id !== tabId);
      if (group.tabs.length !== initialLength) {
        updated = true;
      }
    });

    if (updated) {
      // Remove empty groups
      const filteredGroups = groups.filter((g) => g.tabs.length > 0);
      await chrome.storage.local.set({ groups: filteredGroups });
    }
  } catch (error) {
    console.error("Error handling tab removal:", error);
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case "open-popup":
      chrome.action.openPopup();
      break;
    case "quick-group":
      await quickGroupCurrentTab();
      break;
  }
});

// Quick group current tab
async function quickGroupCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    const result = await chrome.storage.local.get(["groups"]);
    const groups = result.groups || [];

    const url = new URL(tab.url);
    const domain = url.hostname.replace("www.", "");

    // Find existing group for this domain
    let targetGroup = groups.find((g) =>
      g.tabs.some((t) => {
        try {
          return new URL(t.url).hostname.includes(domain);
        } catch (e) {
          return false;
        }
      })
    );

    if (!targetGroup) {
      // Create new group
      const colors = [
        "#8b5a3c",
        "#6d4226",
        "#a0826d",
        "#5c3d2e",
        "#b8956a",
        "#8b6f47",
      ];
      const domainName = domain.split(".")[0];

      targetGroup = {
        id: Date.now(),
        name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
        color: colors[Math.floor(Math.random() * colors.length)],
        tabs: [],
        collapsed: false,
        theme: "gradient",
        icon: "fa-folder",
      };

      groups.push(targetGroup);
    }

    // Add tab to group if not already present
    const tabExists = targetGroup.tabs.some((t) => t.id === tab.id);
    if (!tabExists) {
      targetGroup.tabs.push({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favicon: tab.favIconUrl || "fas fa-globe",
        lastVisited: Date.now(),
        visitCount: 1,
      });
    }

    await chrome.storage.local.set({ groups });

    // Show notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Tab Grouped!",
      message: `Added to "${targetGroup.name}" group`,
      priority: 1,
    });
  } catch (error) {
    console.error("Error quick grouping tab:", error);
  }
}

// Periodic cleanup of stale data (runs every hour)
chrome.alarms.create("cleanup", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "cleanup") {
    await cleanupStaleData();
  }
});

// Clean up stale data
async function cleanupStaleData() {
  try {
    const result = await chrome.storage.local.get(["groups"]);
    const groups = result.groups || [];

    // Get all current tab IDs
    const allTabs = await chrome.tabs.query({});
    const currentTabIds = new Set(allTabs.map((t) => t.id));

    // Remove tabs that no longer exist
    let updated = false;
    groups.forEach((group) => {
      const initialLength = group.tabs.length;
      group.tabs = group.tabs.filter((t) => currentTabIds.has(t.id));
      if (group.tabs.length !== initialLength) {
        updated = true;
      }
    });

    if (updated) {
      // Remove empty groups
      const filteredGroups = groups.filter((g) => g.tabs.length > 0);
      await chrome.storage.local.set({ groups: filteredGroups });
      console.log(
        "Cleanup completed:",
        filteredGroups.length,
        "groups remaining"
      );
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "syncTabs") {
    syncAllTabs().then(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Sync all tabs with storage
async function syncAllTabs() {
  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const result = await chrome.storage.local.get(["groups"]);
    const groups = result.groups || [];

    // Update existing tabs
    groups.forEach((group) => {
      group.tabs.forEach((storedTab) => {
        const currentTab = allTabs.find((t) => t.id === storedTab.id);
        if (currentTab) {
          storedTab.title = currentTab.title;
          storedTab.url = currentTab.url;
          storedTab.favicon = currentTab.favIconUrl || storedTab.favicon;
        }
      });
    });

    await chrome.storage.local.set({ groups });
    return { success: true, groupCount: groups.length };
  } catch (error) {
    console.error("Error syncing tabs:", error);
    return { success: false, error: error.message };
  }
}

console.log("TabFlow background service worker initialized");
