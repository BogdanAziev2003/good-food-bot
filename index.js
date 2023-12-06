const TelegramBot = require('node-telegram-bot-api')
const xlsxPopulate = require('xlsx-populate')
const moment = require('moment-timezone')
const axios = require('axios')
const fs = require('fs')

const groupId = -1002099588087
const path = require('path')
const TOKEN = '6916337720:AAETKuZotosMqW9rJu_STS206ys1ziBoUPs'
const bot = new TelegramBot(TOKEN, { polling: true })
const myTgId = 766417676
let maxGoodId = 0
let maxModifierId = 0

let isGoodsChange = false
let isModifiersChange = false

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text
  // Отправка приветственного сообщения
  if (text === '/start' && chatId !== groupId) {
    const welcomeMessage = `
    Добро пожаловать! 🍽️\n\nЯ бот, который поможет заказть еду с ресторана Good Food. Вы можете выбрать блюда из нашего меню и сделать заказ. 😊\n\nДля просмотра меню и совершения заказа, воспользуйтесь кнопкой ниже:
    `

    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: [
          [
            {
              text: 'Меню 🍔',
              web_app: { url: 'https://good-food.tg-delivery.ru/' },
            },
          ],
        ],
        resize_keyboard: true,
      },
    })
  }

  // Когда получили данные
  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data)
      const { itemInCard } = data
      // Делим данные по сометимости
      const items = splitItemsInCart(itemInCard)

      // Создаю из заказа строку для вывода пользователю
      const itemsString = getItemsString(items)

      // Создаю текст, который отправлю покупателю и ресторану
      const orderText = createOrderText(data, itemsString)

      // Отправляю сообщение о заказе клиенту и добавляю 2 кнопки, также записываю сообщение в переменную для дальнейшего взаимодействия
      await bot
        .sendMessage(chatId, orderText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Подтвердить', callback_data: 'acceptButton' },
                { text: 'Отменить', callback_data: 'cancelButton' },
              ],
            ],
          },
        })
        .then((sentMessage) => {
          const messageId = sentMessage.message_id

          bot.once('callback_query', (query) => {
            const chosenButton = query.data
            // Удаляем инлайн кнопки из сообщения
            bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              {
                chat_id: chatId,
                message_id: messageId,
              }
            )

            // Обработка действия, связанного с выбранной кнопкой
            if (chosenButton === 'acceptButton') {
              bot.sendMessage(chatId, 'Ваш заказ был подтвержден')
              if (data.deliveryType === 'delivery') {
                bot.sendMessage(
                  chatId,
                  'В скором времени наш сотрудник сообщит вам цену доставки'
                )
              }
              bot.sendMessage(myTgId, orderText, {
                parse_mode: 'HTML',
              })
              let textForGroup = `${orderText}\n${
                data.deliveryType === 'delivery'
                  ? 'Укажите стоимость доставки на этот адресс'
                  : ''
              }`
              bot.sendMessage(groupId, textForGroup, {
                parse_mode: 'HTML',
              })
              axios.post('https://server.tg-delivery.ru/api/menu/createOrder', {
                username: msg.from?.username,
                tgId: chatId,
                order: orderText,
                price: data.price,
              })
            } else if (chosenButton === 'cancelButton') {
              bot.sendMessage(chatId, 'Ваш заказ был отменен')
            }
          })
        })
    } catch (e) {
      console.log(e)
      bot.sendMessage(chatId, 'Ошибка при обработке данных')
    }
  }

  if (chatId === groupId) {
    if (text === 'Админка') {
      await bot.sendMessage(chatId, 'Панель администратора', {
        reply_markup: {
          keyboard: [
            [
              {
                text: 'Заказы',
              },
            ],
            [{ text: 'Блюда' }, { text: 'Модификаторы' }],
          ],
          resize_keyboard: true,
        },
      })
    } else if (text === 'Заказы') {
      try {
        bot.deleteMessage(chatId, msg.message_id)
        let xlsxPath = path.join(
          __dirname,
          'orders',
          `${getCurrentDateTime()}.xlsx`
        )
        fs.writeFileSync(xlsxPath, '')

        await fetchData('https://server.tg-delivery.ru/api/menu/getOrders')
          .then((data) => {
            data = AOOtoAOA(data)
            xlsxPopulate
              .fromBlankAsync()
              .then((workbook) => {
                // Получение первого листа
                const sheet = workbook.sheet(0)

                // Запись данных в лист
                data.forEach((row, rowIndex) => {
                  row.forEach((value, columnIndex) => {
                    sheet.cell(rowIndex + 1, columnIndex + 1).value(value)
                  })
                })

                // Сохранение книги в файл
                return workbook.toFileAsync(xlsxPath)
              })
              .then(() => {
                bot.sendDocument(
                  chatId,
                  xlsxPath,
                  {},
                  {
                    contentType:
                      'pplication/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  }
                )
              })
          })
          .finally(() => {
            isGoodsChange = false
            isModifiersChange = false
          })
      } catch (error) {
        console.log(error)
        bot.sendMessage(chatId, 'Xlsx Error: ' + error.message)
      }
    } else if (text === 'Блюда') {
      bot.deleteMessage(chatId, msg.message_id)

      fetchData('https://server.tg-delivery.ru/api/menu/getGoodsName').then(
        (data) => {
          let textForMessage = `Товары:\n${String(
            data.map((el) => {
              return `${el.id}. ${el.title} - ${el.instock}\n`
            })
          )}`
          console.log(data)
          maxGoodId = data.length

          textForMessage = textForMessage.replaceAll(',', '')
          bot.sendMessage(chatId, textForMessage)
          bot.sendMessage(chatId, 'Введите номер товара')
        }
      )
      isGoodsChange = true
      isModifiersChange = false
    } else if (text === 'Модификаторы') {
      bot.deleteMessage(chatId, msg.message_id)

      fetchData('https://server.tg-delivery.ru/api/menu/getModifiersName').then(
        (data) => {
          let textForMessage = `Модификаторы:\n${String(
            data.map((el) => {
              return `${el.id}. ${el.title} - ${el.instock}\n`
            })
          )}`

          maxModifierId = data.length
          textForMessage = textForMessage.replaceAll(',', '')
          bot.sendMessage(chatId, textForMessage)
          bot.sendMessage(chatId, 'Введите номер модификатора')
        }
      )
      isModifiersChange = true
      isGoodsChange = false
    } else if (isGoodsChange) {
      let isNumber = /^\d+$/.test(text)
      if (!isNumber) {
        bot.sendMessage(chatId, 'Нужно ввести число, попробуйте еще раз')
        return
      }

      let id = Number(text)
      console.log(maxGoodId)
      if (id > maxGoodId || id < 1) {
        bot.sendMessage(chatId, 'Введены некоретные данные, попробуйте еще раз')
        return
      }
      try {
        await axios
          .put('https://server.tg-delivery.ru/api/menu/changeInStock', {
            id: id,
          })
          .then(() => {
            bot.sendMessage(chatId, 'Данные были успешно изменены')
            isGoodsChange = false
          })
      } catch (error) {
        console.log(error)
        bot.sendMessage(chatId, 'Произошла какая-то ошибка')
        bot.sendMessage(myTgId, 'Put goods' + error)
      }
    } else if (isModifiersChange) {
      let isNumber = /^\d+$/.test(text)
      if (!isNumber) {
        bot.sendMessage(chatId, 'Нужно ввести число, попробуйте еще раз')
        return
      }

      let id = Number(text)
      console.log(maxModifierId)
      if (id > maxModifierId || id < 1) {
        bot.sendMessage(
          chatId,
          'Введены некоректные данные, попробуйте еще раз'
        )
        return
      }
      try {
        await axios
          .put(
            'https://server.tg-delivery.ru/api/menu/changeInStockModifiers',
            {
              id: id,
            }
          )
          .then(() => {
            bot.sendMessage(chatId, 'Данные были успешно изменены')
            isModifiersChange = false
          })
      } catch (error) {
        console.log(error)
        bot.sendMessage(chatId, 'Произошла какая-то ошибка')
        bot.sendMessage(myTgId, 'Put modifiers' + error)
      }
    }
  }
})

function splitItemsInCart(itemInCard) {
  const itemsCount = itemInCard.reduce((acc, item) => {
    const existingItem = acc.find(
      (i) =>
        i.title === item.title &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
    )
    const existingSandwich = acc.find(
      (i) =>
        i.title === item.title &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers) &&
        i.sause === item.sause &&
        i.snack === item.snack
    )
    if (item.snack) {
      if (existingSandwich) {
        existingItem.count += 1
      } else {
        acc.push({ ...item, count: 1 })
      }
    } else {
      if (existingItem) {
        existingItem.count += 1
      } else {
        acc.push({ ...item, count: 1 })
      }
    }
    return acc
  }, [])

  return itemsCount
}

function getItemsString(items) {
  let res = ''

  items.forEach((item, index) => {
    res += `${index + 1}. ${item.title} x${item.count} ( ${item.price} ₽)\n`
    if (item.snack) {
      res += `+${item.snack}\n+${item.sause}\n`
    }
    if (item.modifiers.length !== 0) {
      res += `Добавки: ${item.modifiers.map(
        (i) => `${i.title.toLowerCase()} x ${i.amount} `
      )}\n`
    }
    res += '\n'
  })

  return res
}

function createOrderText(data, cart) {
  const {
    price,
    address,
    phone,
    deliveryType,
    payMethod,
    comment,
    discountPrice,
  } = data
  res = `Новый заказ:\n\nКорзина:\n${cart}\Номер телефона: ${phone}\nМетод оплаты: <b>${
    payMethod === 'cash' ? 'Наличными' : 'Переводом'
  }</b>\nТип получения: <b>${
    deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка'
  }</b>\n${address !== null ? 'Адресс: ' + address + '\n' : ''}${
    comment !== null ? 'Комментарий к заказу: ' + comment + '\n' : ''
  }`
  res += `\nЦена без скидки: <b>${price}</b> ₽
Цена со скидкой: <b>${discountPrice}</b> ₽`

  return res
}

function getCurrentDateTime() {
  // Получаем текущую дату и время с учетом часового пояса +3
  const currentDate = moment().tz('Europe/Moscow')

  // Форматируем дату и время с разделителями
  return currentDate.format('YYYY-MM-DD_HH-mm-ss')
}

async function fetchData(url) {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error('Fetch error:', error.message)
    bot.sendMessage(myTgId, 'Fetch error: ' + error.message)
  }
}

function AOOtoAOA(arr) {
  return arr.map((obj) => {
    let array = []
    for (let key in obj) {
      array.push(obj[key])
    }
    return array
  })
}
