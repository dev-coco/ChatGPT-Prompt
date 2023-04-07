const d = document
const start = d.getElementById('start')
const input = d.getElementById('input')
const output = d.getElementById('output')
const modifyPrompt = d.getElementById('modifyPrompt')
const addBtn = d.getElementById('addBtn')
const deleteBtn = d.getElementById('deleteBtn')
const importBtn = d.getElementById('importBtn')
const importJson = d.getElementById('importJson')
const exportJson = d.getElementById('exportJson')
const getInit = d.getElementById('getInit')
const items = d.querySelector('.items')
const popup = d.querySelector('.popup')
const refresh = d.querySelector('.refresh-btn')
const importInit = d.querySelector('.import')

// 获取存储
const getStorage = () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['promptList'], (result) => {
      resolve(result.promptList)
    })
  })
}

// 设置提示语
const setPrompt = async () => {
  const promptList = await getStorage()
  const menu = d.querySelector('.items input:checked')
  console.log(menu.value)
  input.value = promptList[menu.value] + '\n'
}

// 重新获取提示语
refresh.addEventListener('click', setPrompt)

// 添加提示语
const addPrompt = async () => {
  let promptList = await getStorage()
  const getName = prompt('为这个提示语起一个名字')
  if (!getName) return
  if (!promptList) promptList = {}
  promptList[getName] = input.value
  chrome.storage.local.set({ promptList })
  setItem()
  popup.classList.toggle('hide')
}

// 删除提示语
const deletePrompt = async () => {
  const promptList = await getStorage()
  const menu = d.querySelector('.items input:checked')
  delete promptList[menu.value]
  chrome.storage.local.set({ promptList })
  setItem()
  popup.classList.toggle('hide')
}

// 设置列表
const setItem = async () => {
  const obj = await getStorage()
  if (!obj) return
  let htmlCode = ''
  let index = 0
  for (const i in obj) {
    index++
    htmlCode += `<input type="radio" id="${index}" name="feature" value="${i}"><label for="${index}">${i}</label><br>`
  }
  items.innerHTML = htmlCode
}
setItem()

// 监听菜单
items.addEventListener('click', setPrompt)
modifyPrompt.addEventListener('click', () => {
  popup.classList.toggle('hide')
})
// 监听添加提示语按钮
addBtn.addEventListener('click', addPrompt)
// 监听删除提示语按钮
deleteBtn.addEventListener('click', deletePrompt)
// 监听修改提示语弹窗背景
popup.addEventListener('click', e => e.target === popup && popup.classList.toggle('hide'))
// 监听导入配置弹窗背景
importInit.addEventListener('click', e => e.target === importInit && importInit.classList.toggle('hide'))

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (str) {
    const randomInt = Math.random() * 16 | 0
    str = 'x' === str ? randomInt : 3 & randomInt | 8
    return str.toString(16)
  })
}

start.addEventListener('click', async function () {
  output.value = '运行中，请等待...'
  const encoder = new TextEncoder()
  const bytes = encoder.encode(input.value)
  if (bytes.length >= 3000) return output.value = '内容太长，请减少内容长度。'

  chrome.storage.local.get(['secretKey'], async ({ secretKey }) => {
    const obj = {
      action: 'next',
      messages: [
        {
          id: uuid(),
          author: { role: 'user' },
          role: 'user',
          content: {
            'content_type': 'text',
            parts: [input.value]
          }
        }
      ],
      parent_message_id: uuid(),
      model: 'gpt-3.5-turbo-0301',
      timezone_offset_min: 240
    }
    const response = await fetch('https://chat.openai.com/backend-api/conversation', {
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        authorization: secretKey,
      },
      body: JSON.stringify(obj),
      method: 'POST',
    })
    if (response.status === 403) {
      output.value = 'token 失效了，请重新获取。'
      return
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let messageID = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (decoder.decode(value).includes('data: [DONE]')) {
        await fetch(`https://chat.openai.com/backend-api/conversation/${messageID}`, {
          headers: {
            'content-type': 'application/json',
            authorization: secretKey,
          },
          body: '{"is_visible":false}',
          method: 'PATCH',
        }).then(response => response.json())
        return
      }
      try {
        const json = JSON.parse(decoder.decode(value).replace(/^data: /g, '').split('\n')[0])
        output.value = json.message.content.parts[0].trim()
        messageID = json.conversation_id
      } catch {
        console.log(decoder.decode(value))
      } // End try catch
    } // End whilte
  }) // End storage
})

// 监听导入配置按钮
importJson.addEventListener('click', async () => importInit.classList.toggle('hide'))

// 监听导出配置按钮
exportJson.addEventListener('click', async () => {
  const promptList = await getStorage()
  const blob = new Blob([JSON.stringify(promptList)], { type: 'application/json' })
  const url = URL.createObjectURL(blob);
  const a = d.createElement('a')
  a.href = url
  a.download = 'promptList.json'
  d.body.appendChild(a)
  a.click()
  d.body.removeChild(a)
  URL.revokeObjectURL(url)
})

// 解析配置
importBtn.addEventListener('click', async () => {
  try {
    let promptList = {}
    if (getInit.value !== 'clear') {
      promptList = await getStorage()
      for (const x of getInit.value.match(/.+/g)) {
        const list = JSON.parse(x)
        for (const i in list) promptList[i] = list[i]
      }
    }
    chrome.storage.local.set({ promptList })
    setItem()
    importInit.classList.toggle('hide')
    getInit.value = ''
  } catch {
    alert('配置格式错误')
  }
})

const cleanList = async () => {
  chrome.storage.local.get(['secretKey'], async ({ secretKey }) => {
    const json = await fetch('https://chat.openai.com/backend-api/conversations?offset=0&limit=20', {
      headers: {
        'content-type': 'application/json',
        authorization: secretKey,
      },
      method: 'GET',
    }).then(response => response.json())
    for (const item of json.items) {
      const result = await fetch(`https://chat.openai.com/backend-api/conversation/${item.id}`, {
        headers: {
          'content-type': 'application/json',
          authorization: secretKey,
        },
        body: '{"is_visible":false}',
        method: 'PATCH',
      }).then(response => response.json())
      console.log(result)
    }
  })
}

