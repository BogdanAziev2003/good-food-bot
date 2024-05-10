const TelegramBot = require("node-telegram-bot-api")
const xlsxPopulate = require("xlsx-populate")
const moment = require("moment-timezone")
const axios = require("axios")
const fs = require("fs")
const path = require("path")
require("dotenv").config()

let goodsId
let modifiersId
let isGoodsChange = false
let isModifiersChange = false
const userData = []

let groupId = Number(process.env.GROUP_ID)

const bot = new TelegramBot(process.env.TOKEN, { polling: true })

bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text
  const repliedMessageText = msg?.reply_to_message?.text
  // Отправка приветственного сообщения
  if (text === "/start" && chatId !== groupId) {
    const welcomeMessage = `
    Добро пожаловать! 🍽️\n\nЯ бот, который поможет заказть еду с кафе Good Food. Вы можете выбрать блюда из нашего меню и сделать заказ. 😊\n\nДля просмотра меню и совершения заказа, воспользуйтесь кнопкой ниже:
    `
    try {
      await bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: {
          keyboard: [
            [
              {
                text: "Меню 🍔",
                web_app: { url: "https://good-food.tg-delivery.ru/" },
              },
            ],
          ],
          resize_keyboard: true,
        },
      })

      await bot.sendPhoto(chatId, "./images/2.PNG")
    } catch (error) {
      bot.sendMessage(process.env.MY_TG_ID, error)
    }
  }
  if (text === "/menu" && chatId !== groupId) {
    try {
      bot.sendMessage(chatId, "Кнопка меню", {
        reply_markup: {
          keyboard: [
            [
              {
                text: "Меню 🍔",
                web_app: { url: "https://good-food.tg-delivery.ru/" },
              },
            ],
          ],
          resize_keyboard: true,
        },
      })
    } catch (error) {}
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
      const orderText = createOrderText(data, itemsString, chatId)

      bot.sendMessage(chatId, orderText, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Подтвердить", callback_data: "acceptButton" },
              { text: "Отменить", callback_data: "cancelButton" },
            ],
          ],
        },
      })
    } catch (e) {
      console.log(e)
      bot.sendMessage(chatId, "Упс, что-то пошло не так. Попробуйте еще раз")
      bot.sendMessage(process.env.MY_TG_ID, e)
    }
  }

  if (chatId === groupId) {
    if (text === "Админка") {
      await bot.sendMessage(chatId, "Панель администратора", {
        reply_markup: {
          keyboard: [
            [
              {
                text: "Заказы",
              },
            ],
            [{ text: "Блюда" }, { text: "Модификаторы" }],
          ],
          resize_keyboard: true,
        },
      })
    } else if (text === "Заказы") {
      try {
        bot.deleteMessage(chatId, msg.message_id)
        let xlsxPath = path.join(
          __dirname,
          "orders",
          `${getCurrentDateTime()}.xlsx`
        )
        fs.writeFileSync(xlsxPath, "")

        await fetchData("https://server.tg-delivery.ru/api/menu/getOrders")
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
                      "pplication/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
        bot.sendMessage(process.env.MY_TG_ID, "Xlsx Error: " + error.message)
        bot.sendMessage(chatId, "Что-то пошло не так.")
      }
    } else if (text === "Блюда") {
      bot.deleteMessage(chatId, msg.message_id)

      fetchData("https://server.tg-delivery.ru/api/menu/getGoodsName")
        .then((data) => {
          let textForMessage = `Товары:\n${String(
            data.map((el) => {
              return `${el.id}. ${el.title} - ${el.instock}\n`
            })
          )}`
          goodsId = data.map((el) => el.id)

          textForMessage = textForMessage.replaceAll(",", "")
          bot.sendMessage(chatId, "Введите номер товара")
          bot.sendMessage(chatId, textForMessage)
        })
        .then(() => {
          isGoodsChange = true
          isModifiersChange = false
        })
    } else if (text === "Модификаторы") {
      bot.deleteMessage(chatId, msg.message_id)

      fetchData("https://server.tg-delivery.ru/api/menu/getModifiersName")
        .then((data) => {
          let textForMessage = `Модификаторы:\n${String(
            data.map((el) => {
              return `${el.id}. ${el.title} - ${el.instock}\n`
            })
          )}`

          modifiersId = data.map((el) => el.id)
          textForMessage = textForMessage.replaceAll(",", "")
          bot.sendMessage(chatId, textForMessage)
          bot.sendMessage(chatId, "Введите номер модификатора")
        })
        .then(() => {
          isModifiersChange = true
          isGoodsChange = false
        })
    } else if (isGoodsChange) {
      if (!goodsId.includes(Number(text))) {
        bot.sendMessage(
          chatId,
          "Введены некоректные данные, попробуйте еще раз"
        )
        isGoodsChange = false
        isModifiersChange = false
        return
      }

      let id = Number(text)

      try {
        await axios
          .put("https://server.tg-delivery.ru/api/menu/changeInStock", {
            id: id,
          })
          .then(() => {
            bot.sendMessage(chatId, "Данные были успешно изменены")
            isGoodsChange = false
            isModifiersChange = false
          })
      } catch (error) {
        bot.sendMessage(chatId, "Произошла какая-то ошибка")
        bot.sendMessage(process.env.MY_TG_ID, "Put goods" + error)
      }
    } else if (isModifiersChange) {
      if (!modifiersId.includes(Number(text))) {
        bot.sendMessage(
          chatId,
          "Введены некоректные данные, попробуйте еще раз"
        )
        isGoodsChange = false
        isModifiersChange = false
        return
      }

      let id = Number(text)

      try {
        await axios
          .put(
            "https://server.tg-delivery.ru/api/menu/changeInStockModifiers",
            {
              id: id,
            }
          )
          .then(() => {
            bot.sendMessage(chatId, "Данные были успешно изменены")
            isModifiersChange = false
            isGoodsChange = false
          })
      } catch (error) {
        console.log(error)
        bot.sendMessage(chatId, "Произошла какая-то ошибка")
        bot.sendMessage(process.env.MY_TG_ID, "Put modifiers" + error)
      }
    } else if (msg.reply_to_message) {
      if (msg.text === undefined || repliedMessageText === undefined) {
        return
      }

      if (!repliedMessageText.includes("Telegram id")) {
        bot.sendMessage(
          groupId,
          "Бот не может обработать ответ на данное сообщение"
        )
        return
      }
      const splitedMessage = repliedMessageText.split("\n")
      const priceText = splitedMessage.filter((el) => el.includes("Цена"))
      const priceTextArray = priceText[priceText.length - 1].split(" ")
      const price = Number(priceTextArray[priceTextArray.length - 2])
      if (Number.isNaN(price)) {
        bot.sendMessage(groupId, "Что-то не так с ценой")
        console.log(price)
        return
      }

      const userTgId = splitedMessage[splitedMessage.length - 1].split('"')[1]

      // ---------------------------------
      try {
        const splitedText = text.split("\n")
        if (splitedText.length > 2) {
          bot.sendMessage(
            groupId,
            "В ответе на сообщение должно быть только не больше 2х строк"
          )
          return
        }
        const [minutes, taxiPrice] = splitedText[0]
          .split(" ")
          .map((el) => Number(el))
        console.log(minutes, taxiPrice)

        if (Number.isNaN(minutes)) {
          bot.sendMessage(groupId, "Время было указана не правильно")
          return
        }

        if (taxiPrice !== undefined && Number.isNaN(taxiPrice)) {
          bot.sendMessage(
            groupId,
            "Стоимость доставки была указана не правильно"
          )
          return
        }

        let textForSend = `Ваш заказ был принят.
Будет готов через ${minutes} мин.
${
  taxiPrice
    ? `Стоимость доставки: ${taxiPrice} ₽
Стоимость заказа вместе с доставкой: ${taxiPrice + price} ₽`
    : ""
}
${splitedText[1] ? splitedText[1] : ""}`
        console.log(true)
        bot.sendMessage(
          groupId,
          "Пользователю было отправлено сообщение:\n" + textForSend
        )
        bot.sendMessage(userTgId, textForSend)
      } catch (error) {
        console.log(error)
        bot.sendMessage(
          process.env.MY_TG_ID,
          "Произошла непредвиденная ошибка при пересылке сообщения"
        )
      }
    }
  }
})

bot.on("callback_query", async (query) => {
  let chatId = query.message.chat.id
  let messageId = query.message.message_id

  switch (query.data) {
    case "acceptButton":
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: messageId,
        }
      )
      await bot.sendMessage(chatId, "Заказ был подтвержден")
      await bot.sendMessage(
        process.env.GROUP_ID,
        query.message.text + `\n\nTelegram id: "${chatId}"`
      )
      if (query.message.text.includes("Доставка")) {
        bot.sendMessage(
          chatId,
          "В скором времени наш сотрудник сообщит вам цену доставки"
        )
      }
      if (query.message.text.includes("Переводом")) {
        bot.sendMessage(
          chatId,
          "Карта для перевода:\n|_ 2202 2061 6829 6213\n|_ Арсен Николаевич Т."
        )
      }
      try {
        let price = query.message.text
          .split("\n")
          .find((el) => el.includes("Цена"))
          .replaceAll("Цена: ", "")
          .replaceAll(" ₽", "")

        axios.post("https://server.tg-delivery.ru/api/menu/createOrder", {
          username: query.message.chat?.username,
          tgId: chatId,
          order: query.message.text,
          price: price,
        })
      } catch (error) {
        console.dir(error)
      }

      break
    case "cancelButton":
      bot.sendMessage(chatId, "Заказ был отменен")

      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: messageId,
        }
      )
      break
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
  let res = ""

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
    res += "\n"
  })

  return res
}

function createOrderText(data, cart, chatId) {
  const {
    price,
    address,
    phone,
    deliveryType,
    payMethod,
    comment,
    discountPrice,
  } = data

  res = `Новый заказ:
  
Корзина:
${cart}
Номер телефона: ${phone}
Метод оплаты: <b>${payMethod === "cash" ? "Наличными" : "Переводом"}</b>
Тип получения: <b>${deliveryType === "pickup" ? "Самовывоз" : "Доставка"}</b>
${address !== null ? "Адрес: " + address : ""}
${comment !== null ? "Комментарий к заказу: " + comment + "\n" : ""}`
  res += ``
  res += `\nЦена: <b>${price}</b> ₽`

  return res
}

function getCurrentDateTime() {
  // Получаем текущую дату и время с учетом часового пояса +3
  const currentDate = moment().tz("Europe/Moscow")

  // Форматируем дату и время с разделителями
  return currentDate.format("YYYY-MM-DD_HH-mm-ss")
}

async function fetchData(url) {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error("Fetch error:", error.message)
    bot.sendMessage(process.env.MY_TG_ID, "Fetch error: " + error.message)
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
