const models = require('./models');
const index = require('../index');
const db = require('../database');

module.exports = (bot) => {
    bot.hears(`📍 Моя машина`, async (ctx)=>{
        if(ctx.res.status !== 3) return;
        const data = await models.openDriverCars(ctx.from.id);
        ctx.replyWithHTML(data.text, {reply_markup: {inline_keyboard: data.but}})
    })

    bot.hears(`🚚 Заявки в работе`, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        const data = await models.getOrdersForDriver(ctx.from.id);
        ctx.replyWithHTML(data.text, {reply_markup: {inline_keyboard: data.but}})
    })

    bot.hears(`🚛 Мои заявки`, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        await ctx.replyWithHTML(`<b>Какие заявки вы хотите видеть?</b>`, {reply_markup: {inline_keyboard: [[{text: 'Назначенные', callback_data: 'driver_my_forms:2'}],[{text: 'Завершенные', callback_data: 'driver_my_forms:3'}],[{text: 'Привязаться к заявке', callback_data: 'attachToFormDriver'}]]}})
    })

    bot.action(/driver_my_forms:(\d+)/, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        let data = await models.getOrdersForDriverByStatus(ctx.from.id, ctx.match[1]);
        data.but.push([{text: 'Вернуться', callback_data: 'driverForms'}])
        ctx.editMessageText(data.text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: data.but}})
    })

    bot.action(`driverForms`, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        await ctx.editMessageText(`<b>Какие заявки вы хотите видеть?</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Назначенные', callback_data: 'driver_my_forms:2'}],[{text: 'Завершенные', callback_data: 'driver_my_forms:3'}],[{text: 'Привязаться к заявке', callback_data: 'attachToFormDriver'}]]}})
    })

    bot.action(`attachToFormDriver`, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        ctx.scene.enter(`attachToForm`)
    })

    bot.action('change_car_driver', async (ctx)=>{
        if(ctx.res.status !== 3) return;
        
        let data = await models.getCarsForDriver(ctx.from.id);
        data.but.push([{text: 'Назад', callback_data: 'back_to_driver_menu'}])
        ctx.editMessageText(data.text, {reply_markup: {inline_keyboard: data.but}, parse_mode: 'HTML'})
    })

    bot.action('back_to_driver_menu', async (ctx)=>{
        if(ctx.res.status !== 3) return;

        const data = await models.openDriverCars(ctx.from.id);
        ctx.editMessageText(data.text, {reply_markup: {inline_keyboard: data.but}, parse_mode: 'HTML'})
    })

    bot.action(/change_car:(\d+)/, async (ctx)=>{
        if(ctx.res.status !== 3) return;

        await db.setDriver(ctx.match[1], ctx.from.id, ctx);
        ctx.answerCbQuery('Машина закреплена за вами')
        const data = await models.openDriverCars(ctx.from.id);
        ctx.editMessageText(data.text, {reply_markup: {inline_keyboard: data.but}, parse_mode: 'HTML'})
    })

    bot.action(/driver_form:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 3 || ctx.res.status === 7) {
            await index.openAncet(ctx, ctx.match[1], 0)
        }
    })

    bot.action(/sos:(\d+)/, async (ctx)=>{
        let but = [
            [{text: 'Не дает деньги', callback_data: `sos_type:${ctx.match[1]}:Не дает деньги`}],
            [{text: 'Застрял', callback_data: `sos_type:${ctx.match[1]}:Застрял`}],
            [{text: 'Не могу дозвонится до клиента', callback_data: `sos_type:${ctx.match[1]}:Не дозвонится до клиента`}],
            [{text: 'Сломалась машина', callback_data: `sos_type:${ctx.match[1]}:Сломалась машина`}],
            [{text: 'Пробило колесо', callback_data: `sos_type:${ctx.match[1]}:Пробило колесо`}],
            [{text: 'Угроза жизни и здоровью', callback_data: `sos_type:${ctx.match[1]}:Угроза здоровью`}],
            [{text: 'Вернуться', callback_data: `driver_form:${ctx.match[1]}`}]
        ]
        ctx.editMessageText(`<b>Ваше сообщение отправится напрямую менеджеру и логисту, используйте только в крайнем случае</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: but}})
    })

    bot.action(/sos_type:(\d+):(.*)/, async (ctx)=>{
        await models.sendSos(ctx.match[1], ctx.match[2], ctx)
        ctx.answerCbQuery('Сообщение отправлено', {show_alert: true})
        await index.openAncet(ctx, ctx.match[1], 0)
    })
    bot.action(/finish_form:(\d+)/, async (ctx)=>{
        await ctx.scene.enter('finish_form', {form_id: ctx.match[1]})
    })
};