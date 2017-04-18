/* -*- Mode: Java; tab-width: 2; indent-tabs-mode:nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gOptions = null, gDefaultOptions = {
  mathFontFamilyList: "Asana Math, Cambria Math, DejaVu Math TeX Gyre, Latin Modern Math, Libertinus Math, Lucida Bright Math, Minion Math, STIX Two Math, TeX Gyre Bonum Math, TeX Gyre Pagella Math, TeX Gyre Schola Math, TeX Gyre Termes Math, XITS Math",
  mathFontFamily: "",
  mathFontScale: 100,
  mathFontImportant: true
};

// List of font scale factors proposed in the context menu.
let gMathFontScaleFactors = [];
for (let maxI = 4, i = -maxI; i <= maxI; i++) {
  gMathFontScaleFactors.push(Math.round(100 * Math.pow(2, i/maxI)));
}

function initializeOptions() {
  // Nothing to do if it's already initialized.
  if (gOptions !== null)
    return Promise.resolve();

  return browser.storage.local.get().then((aOptions) => {
    // Initialize the options using default values for missing keys.
    gOptions = aOptions;
    for (let key in gDefaultOptions) {
      if (!gOptions.hasOwnProperty(key))
        gOptions[key] = gDefaultOptions[key];
    }

    // Register listeners for option changes.
    browser.storage.onChanged.addListener((aChanges, aArea) => {
      if (aArea === "local") {
        for (key in aChanges)
          gOptions[key] = aChanges[key].newValue;
      }
      updateInsertedCSSInAllTabs();
      if (aChanges.hasOwnProperty("mathFontFamilyList")) {
        let oldValue = aChanges.mathFontFamilyList.oldValue;
        removeFontFamilyMenuItems(oldValue).then(createFontFamilyMenuItems);
      } else if (aChanges.hasOwnProperty("mathFontFamily")) {
        updateFontFamilyMenuItems();
      }
      if (aChanges.hasOwnProperty("mathFontScale")) {
        updateFontScaleMenuItems();
      }
    });
  });
}

// Provide the current options to the option.js script when it connects to us.
browser.runtime.onConnect.addListener((aPort) => {
  initializeOptions().then(function() {
    aPort.postMessage(gOptions);
  });
});

let gInsertedCSS = null;

function calculateInsertedCSS() {
  return initializeOptions().then(function() {
    let mathCSS = "";
    let ruleEnd = gOptions.mathFontImportant ? " !important;" : ";"
    if (gOptions.mathFontFamily !== "") {
      let fontFamily = gOptions.mathFontFamily.replace("'", "\\'");
      mathCSS += "font-family: '" + fontFamily + "'" + ruleEnd;
    }
    if (gOptions.mathFontScale > 0 && gOptions.mathFontScale !== 100) {
      mathCSS += "font-size:" + gOptions.mathFontScale + "%" + ruleEnd;
    }
    gInsertedCSS = mathCSS !== "" ? "math {" + mathCSS + "}" : null;
  });
}

function insertCSS(aTab) {
  // FIXME: use cssOrigin: "user"?
  // See https://github.com/fred-wang/webextension-mathml-font-settings/issues/3
  return !gInsertedCSS ? Promise.resolve() :
    browser.tabs.insertCSS(aTab.id, {
      allFrames: true,
      code: gInsertedCSS,
      runAt: "document_start"
    });
}

function removeCSS(aTab, aOldInsertedCSS) {
  // FIXME: use cssOrigin: "user"?
  // See https://github.com/fred-wang/webextension-mathml-font-settings/issues/3
  return !aOldInsertedCSS ? Promise.resolve() :
    browser.tabs.removeCSS(aTab.id, {
      allFrames: true,
      code: aOldInsertedCSS,
      runAt: "document_start"
    });
}

function updateInsertedCSSInAllTabs() {
  return browser.tabs.query({}).then((aTabs) => {
    let oldInsertedCSS = gInsertedCSS;
    return calculateInsertedCSS().then(function() {
      let tabUpdatePromises = [];
      for (tab of aTabs) {
        let tabUpdatePromise = removeCSS(tab, oldInsertedCSS).then(function() {
          insertCSS(tab);
        });
        tabUpdatePromises.push(tabUpdatePromise);
      }
      return Promise.all(tabUpdatePromises);
    });
  });
}

// Insert the CSS into current tabs and listen for tab updates.
updateInsertedCSSInAllTabs().then(function() {
  browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      insertCSS(tab);
    }
  });
});

function fontFamilyListAsArray(aMathFontFamilyList) {
  let mathFonts = aMathFontFamilyList.split(",");
  for (let i = 0; i < mathFonts.length; i++)
    mathFonts[i] = mathFonts[i].trim();
  return mathFonts;
}

function createFontFamilyMenuItems() {
  browser.contextMenus.create({
    id: "mathFontFamily_default",
    parentId: "mathFontFamily",
    type: "radio",
    title: browser.i18n.getMessage("mathFontFamily_default"),
    checked: gOptions.mathFontFamily === "",
    onclick: function() {
      browser.storage.local.set({mathFontFamily: ""});
    }
  });
  let mathFonts = fontFamilyListAsArray(gOptions.mathFontFamilyList);
  for (let i = 0; i < mathFonts.length; i++) {
    let fontFamily = mathFonts[i];
    browser.contextMenus.create({
      id: "mathFontFamily_" + i,
      parentId: "mathFontFamily",
      type: "radio",
      title: fontFamily,
      checked: gOptions.mathFontFamily === fontFamily,
      onclick: function() {
        browser.storage.local.set({mathFontFamily: fontFamily});
      }
    });
  }
}

function removeFontFamilyMenuItems(aOldMathFontFamilyList) {
  let removePromises = [browser.contextMenus.remove("mathFontFamily_default")];
  let mathFonts = fontFamilyListAsArray(aOldMathFontFamilyList);
  for (let i = 0; i < mathFonts.length; i++) {
    let remove = browser.contextMenus.remove("mathFontFamily_" + i);
    removePromises.push(remove);
  }
  return Promise.all(removePromises);
}

function updateFontFamilyMenuItems() {
  browser.contextMenus.update("mathFontFamily_default", {
    checked: gOptions.mathFontFamily === ""
  });
  let mathFonts = fontFamilyListAsArray(gOptions.mathFontFamilyList);
  for (let i = 0; i < mathFonts.length; i++) {
    browser.contextMenus.update("mathFontFamily_" + i, {
      checked: gOptions.mathFontFamily === mathFonts[i]
    });
  }
}

function createFontScaleMenuItems() {
  for (let i = 0; i < gMathFontScaleFactors.length; i++) {
    let scale = gMathFontScaleFactors[i];
    browser.contextMenus.create({
      id: "mathFontScale_" + i,
      parentId: "mathFontScale",
      type: "radio",
      title: scale + "%",
      checked: gOptions.mathFontScale == scale,
      onclick: function() {
        browser.storage.local.set({mathFontScale: scale});
      }
    });
  };
}

function updateFontScaleMenuItems() {
  for (let i = 0; i < gMathFontScaleFactors.length; i++) {
    let scale = gMathFontScaleFactors[i];
    browser.contextMenus.update("mathFontScale_" + i, {
      checked: gOptions.mathFontScale == scale
    });
  }
}

// Create the initial context menu.
initializeOptions().then(function() {
  browser.contextMenus.create({
    id: "mathFontFamily",
    type: "normal",
    title: browser.i18n.getMessage("mathFontFamily_title"),
  });
  createFontFamilyMenuItems();
  browser.contextMenus.create({
    id: "mathFontScale",
    type: "normal",
    title: browser.i18n.getMessage("mathFontScale_title")
  });
  createFontScaleMenuItems();
});
