const models = require('./models');
const db = require('../database');

module.exports = (bot) => {
    bot.hears(`Добавить завод`, async (ctx)=>{
        if(ctx.res.status === 8){
            ctx.scene.enter(`create_zavod`)
        }
    })

    bot.hears(`Управление заводами`, async (ctx)=>{
        if(ctx.res.status === 8){
            const { text, keyboard } = await models.getAllZavods();
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.action(/get_owner_zavod:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 8){
            const { text, keyboard } = await models.getZavod(parseInt(ctx.match[1]));
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })

    bot.action(/delete_zavod_by_owner:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 8){
            await models.deleteZavod(parseInt(ctx.match[1]));

            const { text, keyboard } = await models.getAllZavods();
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })
};