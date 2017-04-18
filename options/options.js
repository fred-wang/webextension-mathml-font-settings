/* -*- Mode: Java; tab-width: 2; indent-tabs-mode:nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function el(aId) {
  return document.getElementById(aId);
}

function saveOptions(aEvent) {
  browser.storage.local.set({
    mathFontFamilyList: el("mathFontFamilyList").value,
    mathFontFamily: el("mathFontFamily").value,
    mathFontScale: el("mathFontScale").value,
    mathFontImportant: el("mathFontImportant").checked
  });
  aEvent.preventDefault();
}

function loadOptions() {
  let port = browser.runtime.connect();
  port.onMessage.addListener((aOptions) => {
    port.disconnect();
    el("mathFontFamilyList").value = aOptions.mathFontFamilyList;
    el("mathFontFamily").value = aOptions.mathFontFamily;
    el("mathFontScale").value = aOptions.mathFontScale;
    el("mathFontImportant").checked = aOptions.mathFontImportant;
    el("options").addEventListener("submit", saveOptions);
  });
}

function localizeUI() {
  let elements = document.getElementsByClassName("localizedString");
  for (var i = 0; i < elements.length; i++) {
    elements[i].innerText = browser.i18n.getMessage(elements[i].innerText);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  localizeUI();
  loadOptions();
});
