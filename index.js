const TelegramBot = require(" ");
const myTgId = 766417676;
const groupId = -4062521049;

const TOKEN = "6603590435:AAGJsw4F1Pk6hrATEbGtbsA3naNqUo1myRM";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  let orderMessage;
  // Отправка приветственного сообщения
  if (text === "/start" && chatId !== groupId) {
    const welcomeMessage = `
    Добро пожаловать! 🍽️\n\nЯ бот, который поможет заказть еду с ресторана Good Food. Вы можете выбрать блюда из нашего меню и сделать заказ. 😊\n\nДля просмотра меню и совершения заказа, воспользуйтесь кнопкой ниже:
    `;

    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Меню 🍔",
              web_app: { url: "https://vermillion-sprite-a15645.netlify.app/" },
            },
          ],
        ],
        resize_keyboard: true,
      },
    });
  }

  // Когда получили данные
  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data);
      const { itemInCard } = data;
      // Делим данные по сометимости
      const items = splitItemsInCart(itemInCard);

      // Создаю из заказа строку для вывода пользователю
      const itemsString = getItemsString(items);

      // Создаю текст, который отправлю покупателю и ресторану
      const orderText = createOrderText(data, itemsString);

      // Отправляю сообщение о заказе клиенту и добавляю 2 кнопки, также записываю сообщение в переменную для дальнейшего взаимодействия
      await bot
        .sendMessage(chatId, orderText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Подтвердить", callback_data: "acceptButton" },
                { text: "Отменить", callback_data: "cancelButton" },
              ],
            ],
          },
        })
        .then((sentMessage) => {
          const messageId = sentMessage.message_id;

          bot.once("callback_query", (query) => {
            const chosenButton = query.data;
            console.log(data);
            // Удаляем инлайн кнопки из сообщения
            bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              {
                chat_id: chatId,
                message_id: messageId,
              }
            );

            // Обработка действия, связанного с выбранной кнопкой
            if (chosenButton === "acceptButton") {
              bot.sendMessage(chatId, "Ваш заказ был подствержден");
              if (data.deliveryType === "delivery") {
                bot.sendMessage(
                  chatId,
                  "В скором времени наш сотрудник сообщит вам цену доставки"
                );
              }

              //
              //
              //
              let textForGroup = `Новый заказ!!!\n${orderText}\n${
                data.deliveryType === "delivery"
                  ? "Укажите стоимость доставки на этот адресс"
                  : ""
              }`;
              bot.sendMessage(groupId, textForGroup);

              //
              //
              //
            } else if (chosenButton === "cancelButton") {
              bot.sendMessage(chatId, "Ваш заказ был отменен");
            }
          });
        });
    } catch (e) {
      console.log(e);
    }
  }
});

function splitItemsInCart(itemInCard) {
  const itemsCount = itemInCard.reduce((acc, item) => {
    const existingItem = acc.find(
      (i) =>
        i.title === item.title &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
    );
    const existingSandwich = acc.find(
      (i) =>
        i.title === item.title &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers) &&
        i.sause === item.sause &&
        i.snack === item.snack
    );
    if (item.snack) {
      console.info("sandwich");
      if (existingSandwich) {
        existingItem.count += 1;
      } else {
        acc.push({ ...item, count: 1 });
      }
    } else {
      if (existingItem) {
        existingItem.count += 1;
      } else {
        acc.push({ ...item, count: 1 });
      }
    }
    return acc;
  }, []);

  return itemsCount;
}

function getItemsString(items) {
  let res = "";

  items.forEach((item, index) => {
    res += `${index + 1}. ${item.title} x${item.count} ( ${item.price} ₽)\n`;
    if (item.snack) {
      res += `+${item.snack}\n+${item.sause}\n`;
    }
    if (item.modifiers.length !== 0) {
      res += `Добавки: ${item.modifiers.map(
        (i) => `${i.title.toLowerCase()} x ${i.amount} `
      )}\n`;
    }
    res += "\n";
  });

  return res;
}

function createOrderText(data, cart) {
  const { price, address, phone, deliveryType, payMethod, comment } = data;
  res = `Заказ №32\n\nКорзина:\n${cart}Цена: ${price}\n\Номер телефона: ${phone}\nМетод оплаты: ${
    payMethod === "cash" ? "Наличными" : "Переводом"
  }\nТип получения: ${deliveryType === "pickup" ? "Самовывоз" : "Доставка"}\n${
    address !== null ? "Адресс: " + address + "\n" : ""
  }${comment !== null ? "Комментарий к заказу: " + comment + "\n" : ""}`;
  return res;
}
