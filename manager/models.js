const db = require('../database')


module.exports = {
    getPostoyaniki: async (zavod) => {
        const postoyaniki = await db.getFormsByZavod(zavod);
        let but = postoyaniki.map(postoyanik => {
            if(postoyanik.entity_text){
            return [{
                text: `${postoyanik.entity_text} | ${postoyanik.betonType} ${postoyanik.betonAmount}м³`,
                callback_data: `get_manager_postoyanik:${postoyanik.fid}`
            }]
            }
        }).filter(item => item !== undefined); // Фильтруем undefined элементы
        return {
            text: '<b>📋 Постоянники</b>',
            keyboard: but
        }
    },
    getPostoyanik: async (fid) => {
        const form = await db.getForm(fid);
        return {
            text: `<b>📋 Постоянник:</b>
<b>• Дата и время:</b> ${form.date}
<b>• Адрес:</b> <code>${form.place}</code> (Нажмите на адрес чтобы скопировать)${form.entity_text === null || form.entity_text === undefined ? '' : `\n<b>• ${form.entity === 0 ? 'Имя' : 'Организация'}:</b> ${form.entity_text}`}${form.type === 1 ? `\n<b>• Номер телефона:</b> ${form.phone}` : ''}
<b>• Бетон:</b> ${form.betonType} - ${form.betonAmount} м³ * ${form.betonUserPrice} (Прайс: ${form.betonPrice})
<b>• Форма оплаты:</b> ${form.payForm}
<b>• Доставка:</b> ${form.deliveryPriceWithAdd}₽ за ${form.deliveryAmount} (Прайс: ${form.deliveryPrice}₽)
<b>• Допы (${form.dopPrice}):</b> ${form.dopAll}
<b>• Стоимость вход:</b> ${form.enterPrice} руб.
<b>• Стоимость выход:</b> ${form.exitPrice} руб.
<b>• Комментарий:</b> ${form.com}`,
            keyboard: [[{text: 'Создать заявку', callback_data: `create_form_of_postoyanik:${form.fid}`}, {text: 'Удалить постоянника', callback_data: `delete_postoyanik:${form.fid}`}],[{text: 'Вернуться', callback_data: 'manager_postoyaniki'}]]
        }
    }
}
