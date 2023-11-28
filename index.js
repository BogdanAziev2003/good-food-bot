const TelegramBot = require("node-telegram-bot-api");

const TOKEN = "6603590435:AAGJsw4F1Pk6hrATEbGtbsA3naNqUo1myRM";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Отправка приветственного сообщения
  if (text === "/start") {
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

  const loremText = `Lorem Ipsum - это текст-"рыба", часто используемый в печати и вэб-дизайне. Lorem Ipsum является стандартной "рыбой" для текстов на латинице с начала XVI века. В то время некий безымянный печатник создал большую коллекцию размеров и форм шрифтов, используя Lorem Ipsum для распечатки образцов. Lorem Ipsum не только успешно пережил без заметных изменений пять веков, но и перешагнул в электронный дизайн. Его популяризации`;
  if (text === "/data") {
    const messageWithButtons = await bot.sendMessage(chatId, loremText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Принять", callback_data: "button1" },
            { text: "Отклонить", callback_data: "button2" },
          ],
        ],
      },
    });

    const messageId = messageWithButtons.message_id;
    console.log(messageId);

    bot.once("callback_query", async (query) => {
      const chosenButton = query.data;

      // Удаляем сообщение с кнопками
      await bot.deleteMessage(chatId, messageId);

      let acceptedMessage = `Ваш заказ был передан, ожидайте`;

      if (isDelivery) {
        acceptedMessage = `Ваш заказ был передан, скоро сотрудник увидет его и огласит вам цену доставки`;
      }
      if (chosenButton === "button1") {
        await bot.sendMessage(chatId, acceptedMessage);
      } else if (chosenButton === "button2") {
        // Действие для кнопки 2
        await bot.sendMessage(chatId, "Ваш заказ был отменен");
      }
    });
  }

  // Когда получили данные
  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data);
      const { itemInCard } = data;
      console.log(data);
      // Делим данные по сометимости
      const items = splitItemsInCart(itemInCard);

      // Создаю из заказа строку для вывода пользователю
      const itemsString = getItemsString(items);

      const message = createOrderText(data, itemsString);
      await bot.sendMessage(chatId, message);
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
  res = `Заказ №32\n\nКорзина:\n${cart}Цена: ${price}\n\Номер телефона: ${phone}`;
  return res;
}
