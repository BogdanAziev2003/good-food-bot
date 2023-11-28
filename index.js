const TelegramBot = require("node-telegram-bot-api");

const isDelivery = true;

const TOKEN = "6603590435:AAGJsw4F1Pk6hrATEbGtbsA3naNqUo1myRM";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

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
            {
              text: "/data",
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
});

function splitItemsInCart(itemInCard) {
  const itemsCount = itemInCard.reduce((acc, item) => {
    const existingItem = acc.find(
      (i) =>
        i.id === item.id &&
        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
    );
    if (existingItem) {
      existingItem.count += 1;
    } else {
      acc.push({ ...item, count: 1 });
    }
    return acc;
  }, []);

  return itemsCount;
}

function getItemsString(items) {
  let res = "";
  items.forEach((el, index) => {
    let modifiers = () => {
      let mod = "";

      el.modifiers.forEach((m) => {
        if (m.amount !== 0) mod += `${m.title.toLowerCase()} x${m.amount}  `;
      });

      if (mod === "") mod = "без добавок";
      return mod;
    };

    res += `${index + 1}. ${el.title} x${
      el.count
    }. \nДобавки: ${modifiers()}\n\n`;
  });

  return res;
}
