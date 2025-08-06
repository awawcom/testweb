const db = require('../database')


module.exports = {
    getAllZavods: async () => {
        const zavods = await db.getAllZavods();
        let but = zavods.map(zavod => {
            return [{
                text: `${zavod.name}`,
                callback_data: `get_owner_zavod:${zavod.fid}`
            }]
        })
        return {
            text: '<b>📋 Список заводов</b>',
            keyboard: but
        }
    },
    getZavod: async (zavodId) => {
        const zavod = await db.getZavod(zavodId);
        let but = [[{text: 'Удалить завод', callback_data: `delete_zavod_by_owner:${zavodId}`}]]
        return {
            text: `<b>🏭 Производитель:</b> <i>${zavod.name}</i>

<b>Адрес:</b> <i>${zavod.place}</i>
<b>Описание:</b> <i>${zavod.discription}</i>

<b>ПРИ УДАЛЕНИИ ТАКЖЕ УДАЛЯЮТСЯ ВСЕ УЧЕТКИ ДАННОГО ЗАВОДА</b>`,
            keyboard: but
        }
    },
    deleteZavod: async (zavodId) => {
        await db.deleteZavod(zavodId);
        await db.deleteAccountsOfZavod(zavodId)
    }
}
