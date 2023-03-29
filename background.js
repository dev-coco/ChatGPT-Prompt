chrome.browserAction.onClicked.addListener(function() {
  chrome.tabs.create({ 'url': 'options.html' })
})

chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    const headers = details.requestHeaders
    console.log(headers)
    try {
      headers.forEach(list => {
        if (list.name === 'Authorization') chrome.storage.local.set({ secretKey: list.value })
      })
    } catch {}
    return { requestHeaders: headers }
  },
  { urls: ['https://chat.openai.com/backend-api/conversation'] },
  ['blocking', 'requestHeaders']
)
