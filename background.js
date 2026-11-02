// Chrome extension service worker
// Automatically opens the side panel when the toolbar action icon is clicked

chrome.runtime.onInstalled.addListener(() => {
  console.log("LocalMind Side Panel Extension installed.");
  // Enables opening side panel directly on clicking the extension icon
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("setPanelBehavior failed:", err);
    });
  }
});

// Fallback listener for Chrome versions where openPanelOnActionClick isn't default
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
      console.warn("sidePanel.open failed:", err);
    });
  }
});
