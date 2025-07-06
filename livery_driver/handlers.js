const models = require('./models');
const index = require('../index');
const db = require('../database');

module.exports = (bot) => {
    bot.hears(`Мои заявки`, async (ctx)=>{
        await ctx.replyWithHTML(`<b>Какие заявки вы хотите видеть?</b>`, {reply_markup: {inline_keyboard: [[{text: 'Назначенные', callback_data: 'driverlivery_my_forms:2'}],[{text: 'Завершенные', callback_data: 'driverlivery_my_forms:3'}]]}})
    })

    bot.hears(`Привязаться к заявке`, async (ctx)=>{
        ctx.scene.enter(`attachToForm`)
    })

    bot.action(/driverlivery_my_forms:(\d+)/, async (ctx)=>{
        let data = await models.getOrdersForDriverByStatus(ctx.from.id, ctx.match[1]);
        data.but.push([{text: 'Вернуться', callback_data: 'livery_driverForms'}])
        ctx.editMessageText(data.text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: data.but}})
    })

    bot.action(`livery_driverForms`, async (ctx)=>{
        await ctx.editMessageText(`<b>Какие заявки вы хотите видеть?</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Назначенные', callback_data: 'driverlivery_my_forms:2'}],[{text: 'Завершенные', callback_data: 'driverlivery_my_forms:3'}]]}})
    })

};