const TelegramBot = require('node-telegram-bot-api');

const TOKEN = "6603590435:AAGJsw4F1Pk6hrATEbGtbsA3naNqUo1myRM"



const bot = new TelegramBot(TOKEN, {polling: true});

bot.on('message', async (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;


  if(text === '/start') {


    const welcomeMessage = `
    Добро пожаловать! 🍽️\n\nЯ бот, который поможет заказть еду с ресторана Good Food. Вы можете выбрать блюда из нашего меню и сделать заказ. 😊\n\nДля просмотра меню и совершения заказа, воспользуйтесь кнопкой ниже:
    `;

      bot.sendMessage(chatId, welcomeMessage, {
          reply_markup: {
              keyboard: [
                  [{text: 'Меню 🍔', web_app: {url: 'https://vermillion-sprite-a15645.netlify.app/'}}]
              ], 
              resize_keyboard: true
          }
      })


  if(msg?.web_app_data?.data) {
      
    bot.sendMessage(chatId, "weqweqwe");
    try {
          const data = JSON.parse(msg?.web_app_data?.data)
          console.log(data)
          

          // setTimeout(async () => {
          //     await bot.sendMessage(chatId, 'Всю информацию вы получите в этом чате');
          // }, 3000)
      } catch (e) {
          console.log(e);
      }
  }
}
});