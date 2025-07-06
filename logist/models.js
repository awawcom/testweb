const db = require('../database');
const index = require(`../index`)

module.exports = {
    getAcceptedForms: async (zavod) => {
        const forms = await db.getAcceptedForms(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 Неотработанные заявки</b>',
            keyboard: but
        }
    },
    createLiveryDriverLink: async (from) => {
        const hash = index.generateRandomString();
        await db.createLink(hash, `addliverydriver`, from)
        return hash;
    },
    getAllForms: async (zavod) =>{
        const forms = await db.getAllFormsLogist(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📅 Список заявок на неделю</b>',
            keyboard: but
        }
    },
    getAllFormsForToday: async (zavod) => {
        const forms = await db.getAllFormsLogistToday(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📅 Список заявок на сегодня</b>',
            keyboard: but
        }
    },
    getAllZavods: async (formId) => {
        const zavods = await db.getAllZavods();
        const form = await db.getForm(formId);
        let but = zavods.filter(zavod => zavod.fid !== form.zavod).map(zavod => {
            return [{
                text: `${zavod.name}`,
                callback_data: `select_zavod_pickups:${formId}:${zavod.fid}`
            }]
        })
        return {
            text: '<b>Выберите завод для доставки</b>',
            keyboard: but
        }
    },
    getAllFormsForNextDay: async (zavod) => {
        const forms = await db.getAllFormsLogistNextDay(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📅 Список заявок на завтра</b>',
            keyboard: but
        }
    },
    getIncomingPickups: async (zavod) => {
        const forms = await db.getAllIncomingPickups(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>🚛 Список входящих заявок на самовывоз</b>',
            keyboard: but
        }
    },
    acceptPickupForm: async (zavod, formId) => {
        let form = await db.getForm(formId);
        if(form.isPickup === 0){
            await db.updateForm(formId, 'isPickup', 1);
            await db.updateForm(formId, 'pickup', zavod);
            return true;
        }
        else{
            return false;
        }
    },
    cancelPickupForm: async (formId) =>{
        await db.updateForm(formId, 'isPickup', 0);
        await db.updateForm(formId, 'pickup', -2);
        return true;
    },
    getConfirmedPickups: async (zavod) => {
        const forms = await db.getAllConfirmedPickups(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `logist_form:${form.fid}`
            }]
        })
        return {
            text: '<b>🚛 Список подтвержденных заявок на самовывоз</b>',
            keyboard: but
        }
    },
    finishPickup: async (formId, zavod) => {
        await db.updateForm(formId, 'isPickup', 3);
        return true;
    }
}