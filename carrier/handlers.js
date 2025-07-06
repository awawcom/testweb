const models = require('./models');
const index = require('../index');
const db = require('../database');

module.exports = (bot) => {
    bot.hears(`Заявки на бронь мне`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getBookingForms(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })
    bot.hears(`Мои машины`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getCars(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })
    bot.hears(`Заявки на бронь общие`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getBookingFormsForAll();
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`Заявки на сегодня`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getBookingFormsForToday(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`Заявки на завтра`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getBookingFormsForNextDay(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })
    bot.hears(`Список заявок`, async (ctx)=>{
        if(ctx.res.status === 6) {
            ctx.replyWithHTML(`📋 <b>Список заявок</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [
                [{text: 'Назначеные', callback_data: 'find_carrier_status:2'}],
                [{text: 'Завершенные', callback_data: 'find_carrier_status:3'}],
                [{text: 'Отмененные', callback_data: 'find_carrier_status:4'}],
            ]}})
        }
    })

    bot.action(/find_carrier_status:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6) {
            let {keyboard} = await models.getFormsByStatus(ctx.match[1], ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'list_of_requests'}])
            return ctx.editMessageReplyMarkup({inline_keyboard: keyboard})
        }
    })
    
    bot.action(`list_of_requests`, async (ctx)=>{
        if(ctx.res.status === 6) {
            ctx.editMessageText(`📋 <b>Список заявок</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [
                [{text: 'Назначеные', callback_data: 'find_carrier_status:2'}],
                [{text: 'Завершенные', callback_data: 'find_carrier_status:3'}],
                [{text: 'Отмененные', callback_data: 'find_carrier_status:4'}],
            ]}})
        }
    })

    bot.action(/carrier_form:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6 || ctx.res.status === 2) {
            index.openAncet(ctx,ctx.match[1], 0)
        }
    })
    bot.action(`carrier_add_car`, async (ctx)=>{
        if(ctx.res.status === 6) {
            ctx.scene.enter('add_car_carrier');
        }
    })
    bot.action(/carrier_car:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6) {
            const car = await db.getCar(ctx.match[1]);
            if(!car) return ctx.answerCbQuery('Машина не найдена');
            ctx.editMessageText(`<b>Машина:</b> ${car.name}`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [[{text: '✕', callback_data: `remove_car_carrier:${car.fid}`}], [{text:'Вернуться', callback_data: 'carrier_cars'}]]}})
        }
    })
    bot.action(`carrier_cars`, async (ctx)=>{
        if(ctx.res.status === 6) {
            const {text, keyboard} = await models.getCars(ctx.res.zavod);
            return ctx.editMessageText(text, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard}})
        }
    })
    bot.action(/reject_booking:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6) {
            const form = await db.rejectBooking(ctx.match[1])
            if(form.logist_id) ctx.telegram.sendMessage(form.logist_id, `<b>Заявка на бронирование: #${form.fid} отклонена</b>`, {parse_mode: 'HTML'})
            await ctx.replyWithHTML(`<b>Заявка на бронирование: #${form.fid} успешно отклонена</b>`, {parse_mode: 'HTML'})
            await ctx.deleteMessage();
        }
    })
    bot.action(/remove_car_carrier:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6) {
            await models.removeCar(ctx.match[1]);
            const {text, keyboard} = await models.getCars(ctx.res.zavod);
            return ctx.editMessageText(text, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard}})
        }
    })
    bot.action(/edit_car:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6 || ctx.res.status === 2) {
            let { keyboard } = await models.getCarsForEditForm(ctx.match[1], ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'carrier_form:' + ctx.match[1]}])
            ctx.editMessageReplyMarkup({inline_keyboard: keyboard})
        }
    })
    bot.action(/add_trip:(\d+)/, async (ctx)=>{
        if(ctx.res.status ===  6 || ctx.res.status === 2) {
            const car = await db.addTrip(ctx.match[1]);
            let {keyboard} = await models.getCarsForEditForm(car.form_id, ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'carrier_form:' + car.form_id}])
            ctx.editMessageReplyMarkup({inline_keyboard: keyboard})
        }
    })
    bot.action(/remove_car_from_form:(\d+)/, async (ctx)=>{
        if(ctx.res.status ===  6 || ctx.res.status === 2) {
            const car = await db.removeCarFromForm(ctx.match[1]);
            console.log(car);
            let {keyboard} = await models.getCarsForEditForm(car, ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'carrier_form:' + car.form_id}])
            ctx.editMessageReplyMarkup({inline_keyboard: keyboard})
        }
    })
    bot.action(/add_car:(\d+):(\d+)/, async (ctx)=>{
        if(ctx.res.status ===  6 || ctx.res.status === 2) {
            let car = await db.getCar(ctx.match[1]);
            await db.addCarToForm(ctx.match[2], ctx.match[1], car.name, 1, 1);
            let {keyboard} = await models.getCarsForEditForm(ctx.match[2], ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'carrier_form:' + ctx.match[2]}])
            ctx.editMessageReplyMarkup({inline_keyboard: keyboard})
        }
    })
    bot.action(/booking_carrier:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 6 || ctx.res.status === 2) {
            ctx.deleteMessage();
            ctx.scene.enter('booking_own_car_carrier', {fid: parseInt(ctx.match[1])})
        }
    })
    bot.action(/offer_conditions:(\d+)/, async (ctx)=>{
        if(ctx.res.status ===  6 || ctx.res.status === 2) {
            ctx.deleteMessage();
            ctx.scene.enter('offer_conditions', {fid: parseInt(ctx.match[1])})
        }
    })
};