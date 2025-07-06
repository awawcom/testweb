const models = require('./models')
const db = require('../database')
const index = require('../index')

module.exports = (bot) => {
    bot.hears(`Отчет за прошедший день`, async (ctx)=>{
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const day = String(yesterday.getDate()).padStart(2, '0');
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const year = yesterday.getFullYear();

        const date = `${day}.${month}.${year}`
        const array = await models.createArrayFormsByDate(date, (await db.getUser(ctx.from.id)).zavod);
        const filepath = await models.createExcelTable(array, date, (await db.getUser(ctx.from.id)).zavod);
        await await ctx.replyWithDocument({
            source: filepath
          });
    })

    bot.hears(`План отгрузок`, async (ctx)=>{
        const array = await models.createArrayFormsShipments((await db.getUser(ctx.from.id)).zavod);
        const filepath = await models.createExcelTable(array, 'shipment', (await db.getUser(ctx.from.id)).zavod);
        await await ctx.replyWithDocument({
            source: filepath
          });
    })
    bot.hears(`Упд`, async (ctx)=>[
        ctx.replyWithHTML(`<b>УПД</b>`, {reply_markup: {inline_keyboard: [[{text: 'За прошлый день', callback_data: 'UPD_accountant_yesterday'}],[{text: 'Общий список', callback_data: 'UPD_accountant_all'}]]}})
    ])

    bot.action(`UPD_accountant_yesterday`, async (ctx)=>{
        if(ctx.res.status === 4) {
            let {text, keyboard} = await models.getUPDFormsYesterday((await db.getUser(ctx.from.id)).zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'upd_accountant'}])
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })

    bot.action(`upd_accountant`, async (ctx)=>{
        ctx.editMessageText(`<b>УПД</b>`, {parse_mode:'HTML',reply_markup: {inline_keyboard: [[{text: 'За прошлый день', callback_data: 'UPD_accountant_yesterday'}],[{text: 'Общий список', callback_data: 'UPD_accountant_all'}]]}})
    })

    bot.action(`UPD_accountant_all`, async (ctx)=>{
        if(ctx.res.status === 4) {
            let {text, keyboard} = await models.getUPDForms((await db.getUser(ctx.from.id)).zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'upd_accountant'}])
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })

    bot.action(/accountant_form:(\d+)/, async (ctx)=>{
        return index.openAncet(ctx, parseInt(ctx.match[1]), 0)
    })

    bot.action(/editUPD:(\d+)/, async (ctx)=>{
        ctx.deleteMessage();
        await db.acceptUPD(parseInt(ctx.match[1]))
        
        const form = await db.getForm(parseInt(ctx.match[1]))
        
        await ctx.telegram.sendMessage(form.created_by,`<b>Бухгалтер ${ctx.res.real_name || ctx.from.first_name} ${ctx.from.username ? `(@${ctx.from.username})` : ''} подписал УПД к заявке #${form.fid}</b>`, {parse_mode:'HTML'})
    })
}