const HOST_ELEMENT_SELECTOR = "[data-testid='teamInbox-rightSide-conversationList-profileName']";
const BUTTON_ID = "mg-wati-button";
const STYLE_ID = "mg-wati-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
  #${BUTTON_ID} { background-color: transparent; transition: background-color .15s ease; }
    #${BUTTON_ID}:hover { background-color: #f3f4f6; }
  `;
  document.head.appendChild(style);
}

function getLogoUrl() {
  // Resolve the packaged asset from the extension root. When injected into the page DOM,
  // the resource must also be listed in web_accessible_resources (see manifest.json).
  return chrome?.runtime?.getURL ? chrome.runtime.getURL("logo.png") : "";
}

function getAssetUrl(path) {
  return chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : "";
}

function createNewTabIcon() {
  const img = document.createElement("img");
  img.src = getAssetUrl("new-tab-icon.svg");
  img.alt = "opens in new tab";
  img.width = 14;
  img.height = 14;
  img.style.marginLeft = "6px";
  img.style.flex = "0 0 auto";
  img.style.display = "block";
  return img;
}

function buildAdminUrl(conversationId) {
  const filter = conversationId ? [{ type: "conversationId", value: conversationId }] : [];
  return `https://GovClerkMinutes.com/admin?tool=5&f=${encodeURIComponent(JSON.stringify(filter))}`;
}

function getConversationIdFromLocation(loc = location) {
  try {
    const url = new URL(loc.href);
    const id = url.pathname.split("/").pop();
    return id || null;
  } catch (_e) {
    return null;
  }
}

function handleButtonClick() {
  const conversationId = getConversationIdFromLocation();
  const toUrl = buildAdminUrl(conversationId);
  window.open(toUrl, "_blank");
}

function buildButton(onClick) {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.style.cssText =
    "margin-left:12px;padding:6px 10px;cursor:pointer;display:inline-flex;align-items:center;border:1px solid #d1d5db;border-radius:8px;";

  const img = document.createElement("img");
  img.src = getLogoUrl();
  img.alt = "logo";
  img.width = 16;
  img.height = 16;
  img.style.display = "block";
  img.style.marginRight = "8px";

  const text = document.createElement("span");
  text.textContent = "Open Conversation";
  text.style.display = "inline-flex";
  text.style.alignItems = "center";
  text.style.lineHeight = "1";
  text.style.marginTop = "1px";

  text.appendChild(createNewTabIcon());

  btn.appendChild(img);
  btn.appendChild(text);
  btn.addEventListener("click", onClick);
  return btn;
}

function ensureButton() {
  if (document.querySelector(`#${BUTTON_ID}`)) {
    return;
  }

  const mainContainer = document.getElementById("mainTeamInbox");
  if (!mainContainer || !mainContainer.firstElementChild) {
    return;
  }

  // Find the second element child of the first child of #mainTeamInbox
  const parent = mainContainer.firstElementChild;
  // Prefer parent.children[1] (second element child). If unavailable, try nextElementSibling.
  const secondElementChild =
    parent.children && parent.children.length > 1
      ? parent.children[1]
      : parent.firstElementChild
        ? parent.firstElementChild.nextElementSibling
        : null;

  const btn = buildButton(handleButtonClick);

  if (!secondElementChild) {
    // Fallback: append into the parent if the expected second child isn't present
    parent.appendChild(btn);
    return;
  }

  // Insert the button as the first element inside the second element child
  if (secondElementChild.firstChild) {
    secondElementChild.insertBefore(btn, secondElementChild.firstChild);
  } else {
    secondElementChild.appendChild(btn);
  }
}

// Run now and on DOM changes (handles route changes in SPAs)
ensureStyles();
ensureButton();
new MutationObserver(() => ensureButton()).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
