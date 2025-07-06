const { Telegraf, Scenes, session } = require('telegraf');
const { setupScenes } = require('./scenes');
const { getUser, query,insertUser, getUsernameByID } = require('./database');
const Calendar = require('telegraf-calendar-telegram');
require('dotenv').config();
const db = require('./database');

const bot = new Telegraf(process.env.BOT_TOKEN);

const { status, entity, mainMenu, ancetaStatus } = require('./data');

function removePriceFromDops(dopsString) {
  return dopsString.split('-')[0].trim();
}


async function clientRegistration(ctx, ref=-1){
    let user = await getUser(ctx.from.id);
    if(user){
        mainMenu(ctx, user.status);
    }
    else{
        ctx.replyWithHTML(`<b>Кто вы?</b>`, {reply_markup: {inline_keyboard:[
                    [{text: 'Физ. лицо', callback_data: `select_entity:0:${ref}`}],
                    [{text: 'Юр. лицо', callback_data: `select_entity:1:${ref}`}]
                ]}})
    }
}
async function workerRegistration(ctx,st, from, zavod){
    let user = await getUser(ctx.from.id);
    if(user){
        mainMenu(ctx, user.status);
    }
    else{
        await insertUser(ctx, ctx.from, '-', st,0,zavod);
        return ctx.scene.enter(`worker_registration`, {from: from})
    }
}
async function driverRegistration(ctx, from){
    let user = await getUser(ctx.from.id);
    if(user){
        mainMenu(ctx, user.status);
    }
    else{
        await insertUser(ctx, ctx.from, '-', 7,0, -1);
        return ctx.scene.enter(`driver_registration`, {from: from})
    }
}
module.exports.userAncets = async (ctx, reply=1) => {
    let but = [];
    let all = await query(`SELECT * FROM forms WHERE (created_by=? OR priv=?)`, [ctx.from.id,ctx.from.id])
    all.forEach((item) => {
        but.push([{text: `#${item.fid} | ${ancetaStatus[item.status]}`, callback_data: `getanc:${item.fid}`}]);
    })
    if(but.length === 0){
        return ctx.replyWithHTML(`📋 <b>На данный момент у вас нет заявок, вы можете создать или найти существующую.</b>

<i>Что желаете?</i>`, {reply_markup: {inline_keyboard: [[{text: 'Поиск по номеру заявки', callback_data: 'search_anc:0'}],[{text: 'Поиск по номеру телефона', callback_data: 'search_anc:1'}], [{text: 'Создать заявку', callback_data: 'search_anc:2'}], [{text: 'Закрыть окно', callback_data: 'delmsg'}]]}})
    }
    but.push([{text: 'Поиск по номеру заявки', callback_data: 'search_anc:0'}],[{text: 'Поиск по номеру телефона', callback_data: 'search_anc:1'}], [{text: 'Создать заявку', callback_data: 'search_anc:2'}], [{text: 'Закрыть окно', callback_data: 'delmsg'}])
    if(reply === 1){
        ctx.replyWithHTML(`📋 <b>Все ваши заявки:</b>`, {reply_markup: {inline_keyboard: but}})
    }
    else{
        ctx.editMessageText(`📋 <b>Все ваши заявки:</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: but}})
    }
}
module.exports.managerAncets = async (ctx, reply=1) => {
    let but = [];
    let all = await query(`SELECT * FROM forms WHERE type=1 AND created_by=? AND (status!=3 OR status!=4) AND zavod=?`, [ctx.from.id, ctx.res.zavod])
    for(const item of all){
        const beton = (await query(`SELECT * FROM nc WHERE name=? AND zavod=?`,[item.betonType, ctx.res.zavod]))[0].name
        but.push([{text: `#${item.fid} | ${ancetaStatus[item.status]} | ${item.betonAmount} м³ | ${beton}`, callback_data: `m_getanc:${item.fid}`}]);
    }
    if(but.length === 0){
        return ctx.replyWithHTML(`📋 <b>На данный момент у вас нет заявок</b>`)
    }
    but.push([{text: 'Закрыть окно', callback_data: 'delmsg'}]);
    if(reply === 1){
        ctx.replyWithHTML(`📋 <b>Все ваши заявки:</b>`, {reply_markup: {inline_keyboard: but}})
    }
    else{
        ctx.editMessageText(`📋 <b>Все ваши заявки:</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: but}})
    }
}
async function getWorker(ctx, id,reply=1){
    let user = await getUser(id);
    if(user){
        let text = `<b>Сотрудник <a href="tg://user?id=${user.id}">${user.real_name}</a> (@${user.username || 'Без тега'})</b>

<b>Должность:</b> <i>${status[user.status]}</i>
<b>Номер телефона:</b> <i>${user.phone}</i>`

        if(reply === 1){
            ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: [[{text:'Удалить сотрудника', callback_data: `delworker:${user.id}`}],[{text:'Вернуться', callback_data: 'workers'}]]}})
        }
        else if(reply === 0){
            ctx.editMessageText(text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text:'Удалить сотрудника', callback_data: `delworker:${user.id}`}],[{text:'Вернуться', callback_data: 'workers'}]]}})
        }
    }
    else{
        ctx.answerCbQuery();
    }
}
module.exports.allWorkers = async (ctx, reply=1) => {
    let but = [];
    let all = await query(`SELECT * FROM users WHERE status!=0 AND status!=5 AND zavod=?`, [ctx.res.zavod]);
    all.forEach((item) => {
        but.push([{text: `${item.real_name || 'Не ввел имя'} | ${status[item.status]}`, callback_data: `getworker:${item.id}`}]);
    })
    but.push([{text: 'Добавить сотрудника', callback_data: 'add_worker'}]);
    but.push([{text: 'Закрыть окно', callback_data: 'delmsg'}]);
    if(reply === 1){
        ctx.replyWithHTML(`👔 <b>Все ваши работники на данный момент</b>`, {reply_markup: {inline_keyboard: but}})
    }
    else{
        ctx.editMessageText(`👔 <b>Все ваши работники на данный момент</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: but}})
    }
}
module.exports.generateRandomString = (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }

    return result;
}
module.exports.allCars = async (ctx, reply=1)=>{
    let but = [];
    let all = await query(`SELECT * FROM cars WHERE zavod=?`, [ctx.res.zavod]);
    all.forEach((item) => {
        but.push([{text: `${item.name}`, callback_data: `ignore`},{text: `Удалить`, callback_data: `deletecar:${item.fid}`}]);
    })
    but.push([{text: 'Добавить машину', callback_data: 'add_car'}]);
    but.push([{text: 'Закрыть окно', callback_data: 'delmsg'}]);
    if(reply === 1){
        ctx.replyWithHTML(`🚚 <b>Все ваши машины на данный момент</b>`, {reply_markup: {inline_keyboard: but}})
    }
    else{
        ctx.editMessageText(`🚚 <b>Все ваши машины на данный момент</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: but}})
    }
}

const {userAncets, allWorkers, allCars, generateRandomString} = require(`./index`);

const stage = new Scenes.Stage(setupScenes());
bot.use(session());
bot.use(stage.middleware());

bot.use(async (ctx,next)=>{
    if (ctx.from && ctx.from.id === ctx.botInfo.id) {
        return;
    }
    if(!ctx.from.username){
        return ctx.replyWithHTML(`❌ <b>У вас нет Username в профиле! Пожалуйста, добавьте его в профиль и попробуйте снова.</b>`)
    }
    if(ctx.message?.text?.startsWith(`/start`)){
        let res = await getUser(ctx.from.id);
        if(res){
            mainMenu(ctx, res.status);
            await query(`UPDATE users SET username=?, name=? WHERE id=?`, [ctx.from.username, ctx.from.first_name, ctx.from.id])
        }
        else{
            let ref = ctx.message.text.split(' ')[1];
            if(ref){
                let link = await query(`SELECT * FROM links WHERE hash=?`, [ref]);
                if(link.length > 0){
                    link = link[0];
                    if(link.do.startsWith(`add:`)){
                        let add_status = parseInt(link.do.split(':')[1])
                        await workerRegistration(ctx,add_status, link.from, link.zavod);
                        await query(`DELETE FROM links WHERE fid=?`, [link.fid]);
                    }
                    else if(link.do === `ref`){
                        await clientRegistration(ctx,link.zavod);
                        await query(`DELETE FROM links WHERE fid=?`, [link.fid]);
                    }
                    else if(link.do === `addliverydriver`){
                        await driverRegistration(ctx,link.from);
                        await query(`DELETE FROM links WHERE fid=?`, [link.fid]);
                    }
                }
                else{
                    clientRegistration(ctx)
                }
            }
            else{
                clientRegistration(ctx)
            }
        }
    }
    else{
        let res = await getUser(ctx.from.id);
        if(res){
            ctx.res = res;
        }
        await next();
        await query(`UPDATE users SET username=?, name=? WHERE id=?`, [ctx.from.username, ctx.from.first_name, ctx.from.id])
    }
})



module.exports.openAncet = async (ctx,id, reply=1)=>{
    const anc = (await query(`SELECT * FROM forms WHERE fid=?`, [id]))[0]

    if(!anc){
        return ctx.replyWithHTML(`❌ <b>Заявка не найдена!</b>`)
    }

    let text;
    let but = [];

    const user = await getUser(ctx.from.id);
    if(user){
        if(user.status === 0){
            let namesOnly = '';
            if(anc.type === 0){
                namesOnly = anc.dopAll;
            }
            else{
                namesOnly = anc.dopAll.split('\n').map(line => removePriceFromDops(line)).join('\n');
            }
            text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>4. Номер телефона:</b> ${anc.phone}
<b>5. Бетон:</b> ${anc.betonType} - ${anc.betonAmount} м³
<b>6. Форма оплаты:</b> ${anc.payForm}
<b>7. Допы:</b> ${namesOnly}
<b>8. Стоимость выход:</b> ${anc.exitPrice === -1 ? 'Не расчитана' : anc.exitPrice + ' руб.'}
<b>9. Комментарий:</b> ${anc.com}
<b>10. Менеджер:</b> ${anc.real_name}`
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])
        }
        else if(user.status === 1){
            text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>4. Номер телефона:</b> ${anc.phone}
<b>5. Бетон:</b> ${anc.betonType} - ${anc.betonAmount} м³ * ${anc.betonUserPrice} (Прайс: ${anc.betonPrice})
<b>6. Форма оплаты:</b> ${anc.payForm}
<b>7. Доставка:</b> ${anc.deliveryPriceWithAdd}₽ за ${anc.deliveryAmount} (Прайс: ${anc.deliveryPrice}₽)
<b>8. Допы (${anc.dopPrice}):</b> ${anc.dopAll}
<b>9. Стоимость вход:</b> ${anc.enterPrice} руб.
<b>10. Стоимость выход:</b> ${anc.exitPrice} руб.
<b>11. Комментарий:</b> ${anc.com}
<b>12. Менеджер:</b> ${anc.real_name}`
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])
            if((anc.type === 1 || anc.type === 2) && anc.status !== 3 && anc.status !== 4){
                if(user.zavod === anc.zavod){
                    but.push([{text: 'Редактировать заявку', callback_data: `form_edit:${anc.fid}`}],
                    [{text: 'Добавить фото/видео', callback_data: `form_add_media:${anc.fid}`}],
                    [{text: 'Отменить заявку', callback_data: `cancel_form:${anc.fid}`}])
                }
            }

        }
        else if(user.status === 2){
            let car_types = await db.getCarTypesByForm(anc.fid);
            let car_types_text;
            if(car_types.length > 0){
                car_types_text = car_types.map(item => `<b>${item.car_name}</b> - ${item.trips} рейс(ов)`).join('\n');
            }
            else{
                car_types_text = 'Не указано';
            }
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])
            if((anc.type === 1 || anc.type === 2 || anc.type === 3) && anc.status !== 3 && anc.status !== 4){
                if(user.zavod === anc.zavod){
                    text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>4. Номер телефона:</b> ${anc.phone}
<b>5. Бетон:</b> ${anc.betonType} - ${anc.betonAmount} м³ * ${anc.betonUserPrice} (Прайс: ${anc.betonPrice})
<b>6. Форма оплаты:</b> ${anc.payForm}
<b>7. Доставка:</b> ${anc.deliveryPriceWithAdd}₽ за ${anc.deliveryAmount} (Прайс: ${anc.deliveryPrice}₽)
<b>8. Допы (${anc.dopPrice}):</b> ${anc.dopAll}
<b>9. Стоимость вход:</b> ${anc.enterPrice} руб.
<b>10. Стоимость выход:</b> ${anc.exitPrice} руб.
<b>11. Комментарий:</b> ${anc.com}
<b>12. Тип авто:</b> 
${car_types_text}
<b>13. Кол-во машин:</b> ${anc.car_count === 0 ? 'Не указано' : anc.car_count}
<b>14. Стоимость доставки для перевозчика:</b> ${anc.carrier_price === 0 ? 'Не указано' : anc.carrier_price + ' руб.'}`
                    if(anc.status === 2){
                        if(anc.pickup === -2){
                            but.push([{text: 'Грузить с другого завода', callback_data: `form_shipment:${anc.fid}`}])
                        }
                        but.push([{text: 'Редактировать авто', callback_data: `edit_car:${anc.fid}`}])
                    }
                    but.push([{text: 'Отправить перевозчикам', callback_data: `send_to_carriers:${anc.fid}`}],
                            [{text: 'Отправить конкретному перевозчику', callback_data: `get_all_carriers:${anc.fid}`}],
                            [{text: 'Забронировать своим транспортом', callback_data: `booking_own_car:${anc.fid}`}],
                            [{text: 'Перенести заявку', callback_data: `form_edit:${anc.fid}:0`},{text: 'Изменить объем', callback_data: `form_edit:${anc.fid}:1`}],
                            [{text: 'Изменить стоимость доставки', callback_data: `form_edit:${anc.fid}:3`}],
                            [{text: 'Уточнение по заявке менеджеру', url: `t.me/${await getUsernameByID(anc.created_by)}`}])
                    }
                else if(anc.pickup === -1 || anc.pickup === user.zavod){
                    text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> Самовывоз
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>5. Бетон:</b> ${anc.betonType} - ${anc.betonAmount} м³ * ${anc.betonUserPrice} (Прайс: ${anc.betonPrice})
<b>6. Общая стоимость:</b> ${anc.betonAmount*anc.betonUserPrice}
<b>7. Тип авто:</b> 
${car_types_text}
<b>8. Кол-во машин:</b> ${anc.car_count === 0 ? 'Не указано' : anc.car_count}
<b>9. Завод:</b> ${anc.zavod !== -2 ? await db.getZavodName(anc.zavod) : await db.getZavodName(anc.pickup)}`
                    if(anc.isPickup === 0){
                        let but2 = [{text: 'Подтвердить', callback_data: `acceptpickupform:${anc.fid}`}]
                        if(anc.pickup !== -1){
                            but2.push({text: 'Отклонить', callback_data: `cancelpickupform:${anc.fid}`})
                        }
                        but.push(but2)
                    }
                    else if(anc.isPickup === 1 && anc.pickup === user.zavod){
                        but.push([{text: 'Завершить', callback_data: `finish_pickup_by_logist:${anc.fid}`},{text: 'Отменить', callback_data: `cancelpickupform:${anc.fid}`}])
                    }
                }
            }
        }
        else if(user.status === 3){
            let car_types = await db.getCarTypesByForm(anc.fid);
            let car_types_text;
            if(car_types.length > 0){
                car_types_text = car_types.map(item => `<b>${item.car_name}</b> - ${item.trips} рейс(ов)`).join('\n');
            }
            else{
                car_types_text = 'Не указано';
            }
            let namesOnly = '';
            if(anc.type === 0){
                namesOnly = anc.dopAll;
            }
            else{
                namesOnly = anc.dopAll.split('\n').map(line => removePriceFromDops(line)).join('\n');
            }
            text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>6. Доставка:</b> ${anc.deliveryPriceWithAdd}₽
<b>7. Комментарий:</b> ${anc.com}
<b>8. Допы:</b> ${namesOnly}
<b>9. Тип авто:</b> 
${car_types_text}
<b>10. Кол-во машин:</b> ${car_types.length === 0 ? 'Не указано' : anc.car_count}
<b>11. Комментарий логиста:</b> ${anc.logist_com || 'Не указан'}
<b>12. Завод:</b> ${await db.getZavodName(anc.zavod) || 'Не указан'}`

            if(anc.carrier_price > 0){
                text += `\n<b>13. Стоимость доставки для перевозчика:</b> ${anc.carrier_price} руб.`
            }
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])

            if((anc.type === 1 || anc.type === 2) && anc.status !== 3 && anc.status !== 4){
                but.push([{text: 'Завершить заявку', callback_data: `finish_form:${anc.fid}`}],
                    [{text: '🆘 SOS', callback_data: `sos:${anc.fid}`}]
                )
            }
        }
        else if(user.status === 4){
            text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>4. Номер телефона:</b> ${anc.phone}
<b>5. Бетон:</b> ${anc.betonType} - ${anc.betonAmount} м³ * ${anc.betonUserPrice} (Прайс: ${anc.betonPrice})
<b>6. Форма оплаты:</b> ${anc.payForm}
<b>7. Доставка:</b> ${anc.deliveryPriceWithAdd}₽ за ${anc.deliveryAmount} (Прайс: ${anc.deliveryPrice}₽)
<b>8. Допы (${anc.dopPrice}):</b> ${anc.dopAll}
<b>9. Стоимость вход:</b> ${anc.enterPrice} руб.
<b>10. Стоимость выход:</b> ${anc.exitPrice} руб.
<b>11. Комментарий:</b> ${anc.com}
<b>12. Менеджер:</b> ${anc.real_name}`
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])
            if((anc.type === 1 || anc.type === 2) && anc.status === 3 && anc.UPD !== 1 && anc.status !== 4){
                if(user.zavod === anc.zavod){
                    but.push([{text: 'Подписать УПД', callback_data: `editUPD:${anc.fid}`}])
                }
            }

        }
        else if(user.status === 6){
            let car_types = await db.getCarTypesByForm(anc.fid);
            let car_types_text;
            if(car_types.length > 0){
                car_types_text = car_types.map(item => `<b>${item.car_name}</b> - ${item.trips} рейс(ов)`).join('\n');
            }
            else{
                car_types_text = 'Не указано';
            }

            text = `<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Адрес:</b> ${anc.place}
<b>6. Доставка:</b> ${anc.deliveryPriceWithAdd}₽
<b>7. Комментарий:</b> ${anc.com}
<b>8. Тип авто:</b> 
${car_types_text}
<b>9. Кол-во машин:</b> ${car_types.length === 0 ? 'Не указано' : anc.car_count}
<b>10. Комментарий логиста:</b> ${anc.logist_com || 'Не указан'}
<b>11. Завод:</b> ${await db.getZavodName(anc.zavod) || 'Не указан'}`

            if(anc.carrier_price > 0){
                text += `\n<b>12. Стоимость доставки для перевозчика:</b> ${anc.carrier_price} руб.`
            }
            but.push([{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}])
            if((anc.type === 1 || anc.type === 2) && anc.status !== 3 && anc.status !== 4){
                if(await db.formIsBookedByCarrier(anc.fid)){
                    but.push([{text: 'Редактировать авто', callback_data: `edit_car:${anc.fid}`}],
                        [{text: 'Отменить бронирование', callback_data: `reject_booking:${anc.fid}`}])
                }
                else if(user.zavod === anc.to_carrier){
                    but.push([{text: 'Забронировать', callback_data: `booking_carrier:${anc.fid}`}],
                            [{text: 'Предложить условия', callback_data: `offer_conditions:${anc.fid}`}],
                            [{text: 'Отказаться', callback_data: `reject_booking:${anc.fid}`}])
                }
                else if(anc.to_carrier === -1){
                    but.push([{text: 'Забронировать', callback_data: `booking_carrier:${anc.fid}`}],
                            [{text: 'Предложить условия', callback_data: `offer_conditions:${anc.fid}`}])
                }
            }
        }

        if(reply === 1){
            ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: but}})
        }
        else{
            ctx.editMessageText(text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: but}})
        }
    }
    else{
        return ctx.replyWithHTML(`❌ <b>Вы не зарегистрированы в системе!</b>`)
    }
}

module.exports.incomingAncets = async (ctx, reply=1) => {
    if(reply === 1){
        await ctx.replyWithHTML(`<b>📩 Входящие заявки</b>`, {reply_markup: {inline_keyboard: [[{text: 'Неотработанные', callback_data: 'incoming_neotr'}], [{text: 'отправлено КП', callback_data: 'incoming_kp'}]]}})
    }
    else if(reply === 0){
        await ctx.editMessageText(`<b>📩 Входящие заявки</b>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Неотработанные', callback_data: 'incoming_neotr'}], [{text: 'отправлено КП', callback_data: 'incoming_kp'}]]}})
    }
}

require('./logist/handlers')(bot);
require('./carrier/handlers')(bot);
require('./driver/handlers')(bot);
require('./livery_driver/handlers')(bot);
require('./accountant/handlers')(bot);

bot.on('text', async (ctx) => {
    const user = ctx.from;
    const text = ctx.message.text;
    if(text === `📋 Оставить заявку на все заводы`){
        return ctx.scene.enter(`create_ancet`)
    }
    else if(text === `ℹ️ Политика конфедациальности`){
        return ctx.replyWithMarkdown(`*# Политика конфиденциальности*

_Настоящая Политика конфиденциальности описывает порядок сбора, хранения, обработки и передачи персональных данных пользователей на сайте [@BHGbeton] (далее — «Сайт»), являющегося онлайн-агрегатором услуг бетонных заводов._

*## 1. Общие положения*

1.1. Настоящая Политика разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» (в редакции, действующей на момент использования Сайта) и направлена на обеспечение конфиденциальности и защиты прав пользователей Сайта при использовании его функционала.

1.2. Использование Сайта означает безоговорочное согласие Пользователя с условиями настоящей Политики конфиденциальности.

*## 2. Цели обработки персональных данных*

2.1. Сайт собирает и обрабатывает персональные данные Пользователя с целью предоставления доступа к сервису по отправке заявок на поставку бетона и последующему взаимодействию между Пользователем и бетонными заводами.

2.2. Обработка персональных данных осуществляется в следующих целях:
- Для формирования и направления заявки Пользователя нескольким бетонным заводам;
- Для обеспечения связи между Пользователем и выбранным бетонным заводом;
- Для выполнения обязательств по оказанию услуг Сайта.

*## 3. Перечень собираемых персональных данных*

3.1. При заполнении формы заявки на поставку бетона Сайт собирает следующую информацию:
- ФИО (при наличии);
- Адрес доставки бетона;
- Контактный номер телефона;
- Данные о необходимом объеме, марке бетона и других параметрах.

*3.2. В случае, если Пользователь регистрируется на Сайте, дополнительно могут собираться:*
- Электронная почта;
- Логин и пароль (шифруются).

*## 4. Порядок передачи данных*

4.1. Все данные, указанные Пользователем в форме заявки, становятся доступны всем бетонным заводам, зарегистрированным на Сайте, после отправки заявки.

4.2. Адрес доставки бетона становится доступным всем бетонным заводам сразу после отправки заявки.

4.3. Контактный номер телефона становится доступным только выбранному Пользователем бетонному заводу в момент принятия предложения завода и подтверждения заявки со стороны Пользователя.

4.4. Передача данных третьим лицам, не связанным с исполнением заявки, не осуществляется, за исключением случаев, предусмотренных законодательством РФ.

*## 5. Хранение и защита персональных данных*

5.1. Сайт обеспечивает конфиденциальность персональных данных Пользователя и принимает все возможные меры для их защиты от несанкционированного доступа, изменения, раскрытия или уничтожения.

5.2. Хранение персональных данных осуществляется в электронном виде с соблюдением требований законодательства РФ в сфере персональных данных.

*## 6. Права Пользователя*

6.1. Пользователь имеет право:
- Получить информацию о том, какие его персональные данные обрабатываются;
- Запросить исправление, удаление своих персональных данных или ограничение их обработки;
- Отозвать согласие на обработку персональных данных, направив соответствующее письмо на адрес электронной почты [указать].

6.2. Указанные действия не влияют на обработку данных, необходимых для выполнения уже оформленных заявок.

*## 7. Изменения в политике конфиденциальности*

7.1. Администрация Сайта вправе вносить изменения в настоящую Политику конфиденциальности без согласия Пользователя. Новая редакция Политики вступает в силу с момента ее размещения на Сайте.

*## 8. Контакты*

8.1. По вопросам, связанным с обработкой персональных данных, Пользователь может обратиться по адресу:  
BHGbeton@gmail.com или телеграмм аккаунт @betonbotnomer1`)
    }
    else if(text === `❗️ У МЕНЯ УЖЕ ЕСТЬ ЗАЯВКА`){
        return userAncets(ctx)
    }
    else if(ctx.res?.status === 5){
        if(text === `🗄 Загрузить номенклатуру`){
            return ctx.scene.enter(`load_nc`)
        }
        else if(text === `👔 Мои сотрудники`){
            return await allWorkers(ctx)
        }
        else if(text === `🚚 Мои машины и водители`){
            return await allCars(ctx)
        }
    }
    else if(ctx.res?.status === 1 || ctx.res?.status === 5){
        if(text === `✏️ Создать заявку`){
            return ctx.scene.enter(`manager_create`)
        }
        else if(text === `📋 Мои заявки`){
            return this.managerAncets(ctx);
        }
        else if(text === `📩 Входящие заявки`){
            return this.incomingAncets(ctx)
        }
        else if(text === `🔎 Поиск заявки`){
            return ctx.scene.enter(`search_ancet`)
        }
        else if(text === `🔗 Реф. программа`){
            ctx.replyWithHTML(`<b>🔗 Создать ссылку для клиента</b>`, {reply_markup: {inline_keyboard: [[{text: 'Создать', callback_data: 'create_link_manager'}]]}})
        }
    }
});
bot.on(`callback_query`, async (ctx)=>{
    const user = ctx.from;
    const cb = ctx.callbackQuery;
    let data = cb.data;
    if(data.startsWith(`select_entity`)){
        await ctx.deleteMessage()
        let e = parseInt(data.split(':')[1]);
        let ref = parseInt(data.split(':')[2]);
        if(e === 0){
            await insertUser(ctx, user, '-', 0, e)
            return ctx.scene.enter(`enter_name`, {ref: ref});
        }
        else if(e === 1){
            await insertUser(ctx, user, '-', 0, e)
            return ctx.scene.enter(`enter_company`, {ref: ref});
        }
    }
    else if(data.startsWith(`getanc:`)){
        return this.openAncet(ctx, parseInt(data.split(':')[1]), 0)
    }
    else if(data.startsWith(`getanc_m:`)){
        return this.openAncet(ctx, parseInt(data.split(':')[1]), 0)
    }
    else if(data.startsWith(`m_getanc:`)){
        return this.openAncet(ctx, parseInt(data.split(':')[1]), 0)
    }
    else if(data.startsWith(`get_form_media:`)){
        let anc = (await query(`SELECT * FROM forms WHERE fid=${data.split(':')[1]}`))[0]
          try {
            const mediaArray = JSON.parse(anc.media);
            if (mediaArray.length === 0) {
                return ctx.answerCbQuery('❌ Медиафайлы отсутствуют.', {show_alert: true});
            }
            else{
                ctx.answerCbQuery();
            }
            const mediaGroup = mediaArray.map(item => ({
                type: item.type,
                media: item.fileId
            }));

            await ctx.replyWithMediaGroup(mediaGroup);
        } catch (error) {
            console.error('Ошибка при отправке медиафайлов:', error);
            ctx.reply('Произошла ошибка при отправке медиафайлов.');
        }
    }
    else if(data.startsWith(`form_add_media:`)){
        let id = parseInt(data.split(':')[1])
        ctx.scene.enter(`editmedia_form`, {anceta: id})
    }
    else if(data.startsWith(`form_edit:`)){
        let c = data.split(':');
        if(c.length === 3){
            ctx.deleteMessage();
            ctx.scene.enter(`edit_form`, {type: parseInt(c[2]), fid: parseInt(c[1])})
        }
        else{
            let anc = (await query(`SELECT * FROM forms WHERE fid=${data.split(':')[1]}`))[0]
            let but = [
                [{text: 'Изменить дату', callback_data: `form_edit:${anc.fid}:0`},{text: 'Изменить объем', callback_data: `form_edit:${anc.fid}:1`}],
                [{text: 'Изменить марку', callback_data: `form_edit:${anc.fid}:2`},{text: 'Изменить выход', callback_data: `form_edit:${anc.fid}:3`}],
                [{text: 'Изменить допы', callback_data: `form_edit:${anc.fid}:4`},],
                [{text: 'Вернуться', callback_data: `form_edit:${anc.fid}`},],
            ]
            ctx.editMessageReplyMarkup({inline_keyboard: but})   
        }
    }
    else if(data.startsWith(`cancel_form:`)){
        await query(`UPDATE forms SET status=4 WHERE fid=?`, [parseInt(data.split(':')[1])])
        this.managerAncets(ctx,0)
    }
    else if(data === `incoming_kp`){
        const all = await query(`SELECT * FROM forms WHERE type=2 AND zavod=? AND created_by=?`, [ctx.res.zavod, ctx.from.id])
        let but = all.map(s=>[{text: `#${s.fid} | ${s.betonType} ${s.betonAmount} м³`, callback_data: `incoming_kp_go:${s.fid}`}])
        but.push([{text: 'Вернуться', callback_data: 'incoming'}])
        ctx.editMessageText(`<b>📩 Отправленные КП</b>`,{parse_mode:'HTML',reply_markup: {inline_keyboard: but}})
    }
    else if(data.startsWith(`incoming_kp_go:`)){
        return this.openAncet(ctx, parseInt(data.split(':')[1]), 0)
    }
    else if(data === `incoming_neotr`){
        const all = await query(`SELECT * FROM forms WHERE type=0 AND (zavod=-1 OR zavod=?) AND calculated=0`, [ctx.res.zavod]);
        let but = all.map(s=>[{text: `#${s.fid} | ${s.betonType} ${s.betonAmount} м³`, callback_data: `incoming_neotr_go:${s.fid}`}])
        but.push([{text: 'Вернуться', callback_data: 'incoming'}])
        ctx.editMessageText(`<b>📩 Входящие заявки</b>`,{parse_mode:'HTML',reply_markup: {inline_keyboard: but}})
    }
    else if(data.startsWith(`incoming_neotr_go:`)){
        let anc = (await query(`SELECT * FROM forms WHERE fid=${data.split(':')[1]}`))[0]
        await ctx.editMessageText(`<b>📋 Заявка #${anc.fid}
1. Статус заявки:</b> ${ancetaStatus[anc.status]}
<b>2. Дата и время:</b> ${anc.date}
<b>3. Марка и обьем:</b> ${anc.betonType} | ${anc.betonAmount} м³
<b>4. Адрес:</b> ${anc.place}
<b>5. Допы:</b> ${anc.dopAll}
<b>6. Комментарий:</b> ${anc.com}
<b>7. Номер телефона:</b> ${anc.phone}`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Обсчитать', callback_data: `startManage:${anc.fid}`}],[{text: 'Открыть фото', callback_data: `get_form_media:${anc.fid}`}],[{text: 'Вернуться', callback_data: 'incoming_neotr'}]]}});
    }
    else if(data === `incoming`){
        return this.incomingAncets(ctx, 0);
    }
    else if(data.startsWith(`startManage:`)){
        let anc = (await query(`SELECT * FROM forms WHERE fid=${data.split(':')[1]}`))[0]
        return ctx.scene.enter(`manager_calculate`, {an: anc});
    }
    else if(data === `manager_anc`){
        return this.managerAncets(ctx,0)
    }
    else if(data === `useranc`){
        return userAncets(ctx,0)
    }
    else if(data.startsWith(`search_anc`)){
        let id = parseInt(data.split(':')[1]);
        if(id === 2){
            await ctx.deleteMessage();
            return ctx.scene.enter(`create_ancet`)
        }
        else if(id === 1){
            await ctx.deleteMessage();
            return ctx.scene.enter(`search_by_phone`)
        }
        else if(id === 0){
            await ctx.deleteMessage();
            return ctx.scene.enter(`search_by_id`)
        }
    }
    else if(data === `add_worker`){
        if(ctx.res.status === 5){
            ctx.editMessageText(`<b>Кого вы хотите добавить?</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [
                        [{text: 'Менеджера', callback_data: 'add_work:1'}],
                        [{text: 'Логиста', callback_data: 'add_work:2'}],
                        [{text: 'Водителя', callback_data: 'add_work:3'}],
                        [{text: 'Бухгалтера', callback_data: 'add_work:4'}],
                        [{text: 'Перевозчика', callback_data: 'add_work:6'}],
                        [{text: 'Вернуться', callback_data: 'workers'}]
                    ]}})
        }
    }
    else if(data === `workers`){
        if(ctx.res.status === 5){
            allWorkers(ctx,0)
        }
    }
    else if(data === `create_link_manager`){
        ctx.deleteMessage();
        let hash = generateRandomString(18)

        let res = await query(`INSERT INTO links (zavod, hash, do, \`from\`) VALUES (?,?,?,?)`, [ctx.res.zavod,hash, `ref`,ctx.from.id])

        const s = await ctx.replyWithHTML(`<b>Создана новая реферальная ссылка для клиента</b>

<b>Ссылка:</b> <a href="t.me/${(await bot.telegram.getMe()).username}?start=${hash}">*СКОПИРУЙТЕ*</a>

<i>ССЫЛКА ОДНОРАЗОВАЯ</i>`, {reply_markup: {inline_keyboard: [[{text: 'Удалить ссылку', callback_data: `deletelink:${res.insertId}`}]]}})
        ctx.pinChatMessage(s.message_id);
    }
    else if(data.startsWith(`add_work:`)){
        ctx.deleteMessage();
        let id = parseInt(data.split(':')[1]);
        let hash = generateRandomString(18)

        let res = await query(`INSERT INTO links (zavod, hash, do, \`from\`) VALUES (?,?,?,?)`, [ctx.res.zavod,hash, `add:${id}`,ctx.from.id])

        const s = await ctx.replyWithHTML(`<b>Создана новая реферальная ссылка для ${status[id]}</b>

<b>Ссылка:</b> <a href="t.me/${(await bot.telegram.getMe()).username}?start=${hash}">*СКОПИРУЙТЕ*</a>

<i>ССЫЛКА ОДНОРАЗОВАЯ</i>`, {reply_markup: {inline_keyboard: [[{text: 'Удалить ссылку', callback_data: `deletelink:${res.insertId}`}]]}})
        ctx.pinChatMessage(s.message_id);
    }
    else if(data.startsWith(`getworker:`)){
        await getWorker(ctx,parseInt(data.split(':')[1]), 0)
    }
    else if(data.startsWith(`deletelink:`)){
        let id = parseInt(data.split(':')[1]);
        await query(`DELETE FROM links WHERE fid=?`, [id])
        await ctx.deleteMessage();
    }
    else if(data.startsWith(`delworker:`)){
        let id = parseInt(data.split(':')[1]);
        await query(`DELETE FROM users WHERE id=?`, [id])
        allWorkers(ctx,0)
    }
    else if(data === `add_car`){
        if(ctx.res.status === 5){
            ctx.deleteMessage();
            return ctx.scene.enter(`add_car`)
        }
    }
    else if(data.startsWith(`deletecar:`)){
        if(ctx.res.status === 5){
            let id = parseInt(data.split(':')[1]);
            await query(`DELETE FROM cars WHERE fid=?`, [id])
            await allCars(ctx,0);
        }
    }
    else if(data === `delmsg`){
        ctx.deleteMessage();
    }
    else {
        ctx.answerCbQuery();
    }
})



bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('Произошла ошибка при обработке вашего запроса.');
});

bot.launch()
    .then(() => console.log('Bot started'))

process.on('uncaughtException', (err) => {
    console.error('⚠️ Непойманная ошибка:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('⚠️ Необработанный промис:', err);
});