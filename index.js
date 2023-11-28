const TelegramBot = require('node-telegram-bot-api')

const TOKEN = '6603590435:AAGJsw4F1Pk6hrATEbGtbsA3naNqUo1myRM'

const bot = new TelegramBot(TOKEN, { polling: true })

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (text === '/start') {
    const welcomeMessage = `
    Добро пожаловать! 🍽️\n\nЯ бот, который поможет заказть еду с ресторана Good Food. Вы можете выбрать блюда из нашего меню и сделать заказ. 😊\n\nДля просмотра меню и совершения заказа, воспользуйтесь кнопкой ниже:
    `

    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: [
          [
            {
              text: 'Меню 🍔',
              web_app: { url: 'https://vermillion-sprite-a15645.netlify.app/' },
            },
          ],
        ],
        resize_keyboard: true,
      },
    })
  }

  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data)
      const { itemInCard } = data

      const items = splitItemsInCart(itemInCard)
      console.log('items')

      const itemsString = getItemsString(items)

      console.log('itemsString')
      await bot.sendMessage(chatId, itemsString)
    } catch (e) {
      console.log(e)
    }
  } else {
    console.log('not data')
  }
})

function splitItemsInCart(itemInCard) {
  const itemsCount = itemInCard.reduce((acc, item) => {
    const existingItem = acc.find(
      (i) =>
        i.id === item.id &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
    )
    if (existingItem) {
      existingItem.count += 1
    } else {
      acc.push({ ...item, count: 1 })
    }
    return acc
  }, [])

  return itemsCount
}

function getItemsString(items) {
  let res = ''
  items.forEach((el, index) => {
    let modifiers = () => {
      let mod = ''

      el.modifiers.forEach((m) => {
        if (m.amount !== 0) mod += `${m.title.toLowerCase()} x${m.amount}  `
      })

      if (mod === '') mod = 'без добавок'
      return mod
    }

    res += `${index + 1}. ${el.title} x${
      el.count
    }. \nДобавки: ${modifiers()}\n\n`
  })

  return res
}
