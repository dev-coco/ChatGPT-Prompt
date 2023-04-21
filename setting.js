const scriptUrl = document.getElementById('scriptUrl')

scriptUrl.addEventListener('keyup', () => {
  chrome.storage.local.set({ getScriptUrl: scriptUrl.value })
})

chrome.storage.local.get('getScriptUrl', ({ getScriptUrl }) => {
  const setScript = getScriptUrl || ''
  scriptUrl.value = setScript
})
