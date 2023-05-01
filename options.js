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

let status = true
// 挂起等待
const wait = () => new Promise((resolve, reject) => {
  const retry = setInterval(() => {
    if (status === false) {
      status = true
      clearInterval(retry)
      resolve()
    }
  }, 1000)
})

const req = async (str, custom) => {
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
            parts: [str]
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
      output.value = 'token 失效了，请打开 ChatGPT 网页获取。'
      return status = true
    }
    if (response.status === 429) {
      return status = true
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let messageID = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        status = false
        break
      }
      if (decoder.decode(value).includes('data: [DONE]')) {
        await fetch(`https://chat.openai.com/backend-api/conversation/${messageID}`, {
          headers: {
            'content-type': 'application/json',
            authorization: secretKey,
          },
          body: '{"is_visible":false}',
          method: 'PATCH',
        }).then(response => response.json())
      }
      try {
        const json = JSON.parse(decoder.decode(value).replace(/^data: /g, '').split('\n')[0])
        output.value = (custom ? custom + '\n\n' : '') + json.message.content.parts[0].trim()
        messageID = json.conversation_id
      } catch {
        const result = decoder.decode(value)
        if (result.includes('event: ping')) status = true
      } // End try catch
    } // End whilte
  }) // End storage
}

// 获取自定义内容
async function customContent (type) {
  const url = await new Promise((resolve, reject) => {
    chrome.storage.local.get('getScriptUrl', ({ getScriptUrl }) => {
      resolve(getScriptUrl)
    })
  })
  const body = new FormData()
  body.append('type', type)
  const text = await fetch(url, {
    body,
    method: 'POST'
  }).then(response => response.text())
  return text
}

start.addEventListener('click', async function () {
  output.value = '运行中，请等待...'
  const encoder = new TextEncoder()
  const bytes = encoder.encode(input.value)
  if (bytes.length >= 5000) return output.value = '内容太长，请减少内容长度。'
  if (input.value.includes('---@@@---')) {
    const content = input.value.split('---@@@---')
    let question = ''
    // 第一次请求
    await req(content[0])
    console.log(5, status)
    await wait()
    console.log(6, status)
    // 记录需要问的问题
    question = content[0].replace(/\n/g, '').match(/(?<=content：).+/g)[0]
    const list = content[0].match(/(?<=\[').*?(?='\])/g)[0].split("','")
    // 格式化
    const getType = () => {
      for (const x of list) {
        try {
          return output.value.match(new RegExp(x, 'gi'))[0]
        } catch { }
      } // End for of
    } // End function
    output.value += '\n请求中...'
    // 根据类型获取自定义内容
    const custom = await customContent(getType())
    await req(`${content[1]}\n${custom}\n${question}`, custom)
    await wait()
    console.log(7, status)
  } else {
    await req(input.value)
    await wait()
  }
  
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
      promptList = await getStorage() || {}
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
