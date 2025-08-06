const mysql = require('mysql-await');
require('dotenv').config();
console.log(process.env.DB_HOST)
const pool = mysql.createPool({
    connectionLimit: 5,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    } else {
        throw err;
    }
});

module.exports = {
    getAcceptedForms: async (zavod) => {
        const forms = await pool.awaitQuery(`SELECT * FROM forms WHERE status=1 AND type=1 AND zavod=?`, [zavod])
        return forms;
    },
    getFormsToCarrier: async (zavod) => {
        const forms = await pool.awaitQuery(`SELECT f.* 
FROM forms f
WHERE (f.status=1 OR f.status=2) 
  AND f.type=1
  AND f.to_carrier=?
  AND (
      NOT EXISTS (SELECT 1 FROM form_cars fc WHERE fc.form_id = f.fid)
      OR
      NOT EXISTS (
          SELECT 1 
          FROM form_cars fc 
          WHERE fc.form_id = f.fid AND fc.carrier = 1
      )
  )`, [zavod]);
        return forms;
    },
    getUser: async (id) => {
        let user = await pool.awaitQuery(`SELECT * FROM users WHERE id=?`, [id])
        if(user.length > 0){
            return user[0];
        }
        else{
            return null;
        }
    },
    getUsernameByID: async (id) => {
        let user = await pool.awaitQuery(`SELECT username FROM users WHERE id=?`, [id])
        if(user.length > 0){
            return user[0].username;
        }
        else{
            return null;
        }
    },
    insertUser: async (ctx,user, phone, status, entity, zavod=-1, real_name='-',company='-') => {
        try{
            return await pool.awaitQuery(`INSERT INTO users (id, phone, name, username, status, entity, company,real_name,zavod) VALUES (?,?,?,?,?,?,?,?,?)`, [user.id, phone, user.first_name, user.username || 'Нету юзернейма', status, entity, company, real_name, zavod])
        }
        catch (e) {
            await ctx.replyWithHTML(`<b>Произошла ошибка в боте, напишите в поддержку!</b>`)
            return e;
        }
    },
    createForm: async (params)=>{
        const {
            type,
            created_by,
            date = '-',
            place = '-',
            phone = '-',
            betonType = '-',
            betonAmount = -1,
            betonUserPrice = -1,
            betonPrice = -1,
            payForm = '-',
            deliveryPriceWithAdd = -1,
            deliveryPrice = -1,
            deliveryAmount = -1,
            dopAll = '-',
            dopPrice = -1,
            enterPrice = -1,
            exitPrice = -1,
            com = '-',
            real_name = '-',
            zavod = -1,
            status = 0,
            priv = -1,
            media = '-',
            last_fid = -1,
            entity = -1,
            entity_text = null,
            pickup = -2,
            isPickup = 0
        } = params;
        try{
            let res = await pool.awaitQuery(`INSERT INTO forms (type, created_by, date, place, phone, betonType, betonAmount, betonUserPrice, betonPrice, payForm, deliveryPriceWithAdd,deliveryPrice,deliveryAmount,dopAll,dopPrice,enterPrice,exitPrice,com,real_name,zavod,status,priv, media, last_fid, entity, entity_text, pickup, isPickup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, ?, ?)`, [type, created_by, date, place, phone, betonType, betonAmount, betonUserPrice, betonPrice, payForm, deliveryPriceWithAdd,deliveryPrice,deliveryAmount,dopAll,dopPrice,enterPrice,exitPrice,com,real_name,zavod,status,priv, media, last_fid, entity, entity_text, pickup, isPickup])
            return res.insertId;
        }
        catch(e){
            await ctx.replyWithHTML(`<b>Произошла ошибка в боте, напишите в поддержку!</b>`)
            return;
        }
    },
    query: async (query, params=[]) => {
        return await pool.awaitQuery(query, params);
    },
    getCars: async (zavod) => {
        const cars = await pool.awaitQuery(`SELECT * FROM cars WHERE zavod=?`, [zavod])
        return cars;
    },
    createCarrierCar: async (name, zavod, driver=-1) => {
        return (await pool.awaitQuery(`INSERT INTO cars (name, zavod, driver) VALUES (?,?,?)`, [name, zavod,driver])).insertId;
    },
    getCar: async (fid) => {
        const car = await pool.awaitQuery(`SELECT * FROM cars WHERE fid=?`, [fid])
        return car[0];
    },
    removeCar: async (fid) => {
        return await pool.awaitQuery(`DELETE FROM cars WHERE fid=?`, [fid])
    },
    getForm: async (fid) => {
        const form = await pool.awaitQuery(`SELECT * FROM forms WHERE fid=?`, [fid])
        return form[0];
    },
    rejectBooking: async (fid) => {
        return await pool.awaitQuery(`UPDATE forms SET to_carrier=-2, carrier_price=0 WHERE fid=?`, [fid])
    },
    bindLogist: async (fid, logist) => {
        return await pool.awaitQuery(`UPDATE forms SET logist_id=? WHERE fid=?`, [logist, fid])
    },
    addCarsToForm: async (fid, cars_count, cars_types) => {
        return await pool.awaitQuery(
            `UPDATE forms
             SET car_count = car_count + ?,
                 car_type = TRIM(BOTH ', ' FROM CONCAT(IFNULL(NULLIF(car_type, ''), ''), IF(car_type IS NULL OR car_type = '', '', ', '), ?))
             WHERE fid = ?`,
            [cars_count, cars_types, fid]
        );
    },
    getCarTypesByForm: async (fid) => {
        const car_types = await pool.awaitQuery(`SELECT * FROM form_cars WHERE form_id=?`, [fid])
        return car_types;
    },
    addCarToForm: async (form_id, car_number,car_name, trips, carrier) => {
        const existing = await pool.awaitQuery(
            'SELECT * FROM form_cars WHERE form_id=? AND car_id=?',
            [form_id, car_number]
        );
        if (existing.length > 0) {
            return await pool.awaitQuery(
                'UPDATE form_cars SET trips=? WHERE form_id=? AND car_id=? AND carrier=?',
                [trips, form_id, car_number, carrier]
            );
        } else {
            return await pool.awaitQuery(
                'INSERT INTO form_cars (form_id, car_id,car_name, trips, carrier) VALUES (?, ?, ?, ?, ?)',
                [form_id, car_number,car_name, trips, carrier]
            );
        }
    },
    addTrip: async (id) => {
        await pool.awaitQuery(
            'UPDATE form_cars SET trips=trips+1 WHERE id=?',
            [id]
        )
        return (await pool.awaitQuery(
            'SELECT * FROM form_cars WHERE id=?',
            [id]
        ))[0]
    },
    removeCarFromForm: async (fid) => {
        const car = (await pool.awaitQuery(
            'SELECT * FROM form_cars WHERE id=?',
            [fid]
        ))[0]
        await pool.awaitQuery(
            'DELETE FROM form_cars WHERE id=?',
            [fid]
        )
        return car.form_id;
    },
    getFormsByStatusCarrier: async (status, carrier) => {
        const forms = await pool.awaitQuery(`SELECT * FROM forms WHERE status=? AND to_carrier=?`, [status, carrier])
        return forms;
    },
    createOfferConditions: async (form_id, edit, value, created_by) => {
        return (await pool.awaitQuery(
            'INSERT INTO `condition` (form_id, edit, newvalue, created_by) VALUES (?, ?, ?, ?)',
            [form_id, edit, value, created_by]
        )).insertId;
    },
    getFormsToCarrierToday: async (zavod) => {
        const forms = await pool.awaitQuery(`SELECT DISTINCT f.* 
FROM forms f
INNER JOIN form_cars fc ON f.fid = fc.form_id
WHERE (f.status=1 OR f.status=2) 
  AND f.type=1
  AND f.to_carrier=?
  AND fc.carrier = 1
  AND SUBSTRING(f.date, 1, 10) = DATE_FORMAT(CURDATE(), '%d.%m.%Y')`, [zavod])
        return forms;
    },
    formIsBookedByCarrier: async (fid) => {
        const form = await pool.awaitQuery(`SELECT DISTINCT f.* 
FROM forms f
INNER JOIN form_cars fc ON f.fid = fc.form_id
WHERE (f.status=1 OR f.status=2) 
  AND f.type=1
  AND f.fid = ?
  AND fc.carrier = 1`, [fid])
        return form.length > 0;
    },
    getFormsToCarrierNextDay: async (zavod) => {
        const forms = await pool.awaitQuery(`SELECT DISTINCT f.* 
FROM forms f
INNER JOIN form_cars fc ON f.fid = fc.form_id
WHERE (f.status=1 OR f.status=2) 
  AND f.type=1
  AND f.to_carrier=?
  AND fc.carrier = 1
  AND SUBSTRING(f.date, 1, 10) = DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%d.%m.%Y')`, [zavod])
                    return forms;
    },
    getZavodName: async (zavod) => {
        const z = await pool.awaitQuery(`SELECT * FROM zavod WHERE fid=?`, [zavod])
        return z[0]?.name || 'Завод не найден';
    },
    getCondition: async (id) => {
        const condition = await pool.awaitQuery(`SELECT * FROM \`condition\` WHERE fid=?`, [id])
        return condition[0];
    },
    updateForm: async (fid, edit, value) => {
        return await pool.awaitQuery(`UPDATE forms SET ${edit}=? WHERE fid=?`, [value, fid])
    },
    updateZavod: async (fid, key, value) => {
        return await pool.awaitQuery(`UPDATE zavod SET \`${key}\`=? WHERE fid=?`, [value, fid])
    },
    getFormsToAllCarriers: async () => {
        const forms = await pool.awaitQuery(`SELECT * FROM forms WHERE (status=2 OR status=1) AND type=1 AND to_carrier=-1`)
        return forms;
    },
    findCarByDriver: async (driver) => {
        const car = await pool.awaitQuery(`SELECT * FROM cars WHERE driver=?`, [driver])
        return car[0];
    },
    findCarsForDriver: async (driver) => {
        const zavod = (await pool.awaitQuery(`SELECT * FROM users WHERE id=?`, [driver]))[0].zavod;
        if(zavod === -1){
            return null;
        }
        else{
            const cars = await pool.awaitQuery(`SELECT * FROM cars WHERE zavod=?`, [zavod])
            return cars;
        }
    },
    setDriver: async (car_id, driver, ctx) => {

        const car = await pool.awaitQuery(`SELECT * FROM cars WHERE fid=?`, [car_id])

        if(car.length > 0){
            const logists = await pool.awaitQuery(`SELECT * FROM users WHERE status=2 AND zavod=?`, [car[0].zavod])
            const driver_name = (await pool.awaitQuery(`SELECT * FROM users WHERE id=?`, [driver]))[0].real_name;
            for(const logist of logists){
                await ctx.telegram.sendMessage(logist.id, `❗️ <b>Водитель ${driver_name} закрепил за собой машину ${car[0].name}</b>`, {parse_mode: 'HTML'})
            }

            const driver_car = await pool.awaitQuery(`SELECT * FROM cars WHERE driver=?`, [driver])
            if(driver_car.length > 0){
                await pool.awaitQuery(`UPDATE cars SET driver=? WHERE fid=?`, [-1, driver_car[0].fid])
            }

            return await pool.awaitQuery(`UPDATE cars SET driver=? WHERE fid=?`, [driver, car_id])
        }
        else{
            return null;
        }
    },
    getFormsForDriver: async (driver) => {
        const forms = await pool.awaitQuery(`SELECT forms.* 
FROM forms
JOIN form_cars ON forms.fid = form_cars.form_id
JOIN cars ON form_cars.car_id = cars.fid
WHERE cars.driver = ? AND forms.status = 2`, [driver])
        return forms;
    },
    getManagersAndLogistsByZavodAndForm: async (zavod, formId) => {
        const all = await pool.awaitQuery(`SELECT * FROM users WHERE (status=2 OR status=1) AND (zavod=? OR zavod=(SELECT zavod FROM forms WHERE fid=?))`, [zavod, formId])
        return all;
    },
    getCarByDriver: async (driver) => {
        const car = await pool.awaitQuery(`SELECT * FROM cars WHERE driver=?`, [driver])
        return car[0];
    },
    addDriverFinishForm: async (params) => {
        const {
            form_id,
            created_by,
            amount = 0,
            money_get = 0,
            money_type = '-',
            dops = '-',
            ttn = '-',
            carname = 'Неизвестная машина'
        } = params;
        return (await pool.awaitQuery(`INSERT INTO driver_forms (form_id, created_by, amount, money_get, money_type, dops, ttn, carname) VALUES (?,?,?,?,?,?,?,?)`, [form_id, created_by, amount, money_get, money_type, dops, ttn, carname])).insertId
    },
    getFormsForDriverByStatus: async (driver, status) => {
        const forms = await pool.awaitQuery(`SELECT forms.* 
            FROM forms
            JOIN form_cars ON forms.fid = form_cars.form_id
            JOIN cars ON form_cars.car_id = cars.fid
            WHERE cars.driver = ? AND forms.status = ?`, [driver, status])
        return forms;
    },
    createLink: async (hash, do_, from, zavod=-1) => {
        return (await pool.awaitQuery(`INSERT INTO links (zavod,hash,\`do\`,\`from\`) VALUES (?,?,?,?)`, [zavod, hash, do_, from])).insertId
    },
    updateUser: async (userId, key, value) => {
        return await pool.awaitQuery(`UPDATE users SET \`${key}\`=? WHERE id=?`, [value, userId]);
    },
    createZavod: async (created_by, name, type, place='-', discription='-') =>{
        return (await pool.awaitQuery(`INSERT INTO zavod (id,name,place,discription,type) VALUES (?,?,?,?,?)`, [created_by, name, place, discription, type])).insertId;
    },
    getFinishedFormsByDate: async (date, zavod) => {
        const res = await pool.awaitQuery(`SELECT * FROM forms f WHERE (status=3 OR status=4) AND SUBSTRING(f.date, 1, 10) = ? AND zavod=?`, [date,zavod]);
        return res;
    },
    getFinishedPickupsByDate: async (date, zavod) => {
        const res = await pool.awaitQuery(`SELECT * FROM forms f WHERE isPickup=3 AND SUBSTRING(f.date, 1, 10) = ? AND pickup=?`, [date,zavod]);
        return res;
    },
    getAllTripsByForm: async (formId) =>{
        return await pool.awaitQuery(`SELECT * FROM driver_forms WHERE form_id=?`, [formId]);
    },
    getZavodNameByUser: async (userId)=>{
        return (await pool.awaitQuery(`SELECT * FROM zavod WHERE fid=(SELECT zavod FROM users WHERE id=?)`, [userId]))[0].name
    },
    getFormsToShipment: async (zavod)=>{
        return await pool.awaitQuery(`SELECT * FROM forms WHERE (status=1 OR status=2) AND type=1 AND zavod=?`, [zavod])
    },
    getUPDFormsYesterday: async (zavod)=>{
        return await pool.awaitQuery(`SELECT f.* 
FROM forms f
JOIN users u ON f.priv = u.id AND u.entity = 1
WHERE f.zavod = ?
  AND SUBSTRING(f.date, 1, 10) = DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY), '%d.%m.%Y')
  AND f.status=3
  AND f.UPD=0`, [zavod])
    },
    getUPDForms: async (zavod)=>{
        return await pool.awaitQuery(`SELECT f.* 
FROM forms f
JOIN users u ON f.priv = u.id AND u.entity = 1
WHERE f.zavod = ?
  AND f.status=3
  AND f.UPD=0`, [zavod])
    },
    acceptUPD: async (formId)=>{
        return await pool.awaitQuery(`UPDATE forms SET UPD=1 WHERE fid=?`, [formId])
    },
    getAllFormsLogist: async (zavod)=>{
        return await pool.awaitQuery(`SELECT * FROM forms WHERE status=2 AND zavod=? `, [zavod])
    },
    getAllFormsLogistToday: async (zavod) => {
        return await pool.awaitQuery(`SELECT f.* FROM forms f WHERE status=2 AND zavod=?  AND SUBSTRING(f.date, 1, 10) = DATE_FORMAT(CURDATE(), '%d.%m.%Y')`, [zavod])
    },
    getAllFormsLogistNextDay: async (zavod) => {
        return await pool.awaitQuery(`SELECT f.* FROM forms f WHERE status=2 AND zavod=?  AND SUBSTRING(f.date, 1, 10) = DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%d.%m.%Y')`, [zavod])
    },
    getAllZavods: async () => {
        return await pool.awaitQuery(`SELECT * FROM zavod WHERE type=0`)
    },
    getZavod: async (zavodId) => {
        const zavod = await pool.awaitQuery(`SELECT * FROM zavod WHERE fid=${zavodId}`);
        return zavod[0];
    },
    deleteZavod: async (zavodId) => {
        return await pool.awaitQuery(`DELETE FROM zavod WHERE fid=?`, [zavodId])
    },
    deleteAccountsOfZavod: async (zavodId) => {
        return await pool.awaitQuery(`DELETE FROM users WHERE zavod=?`, [zavodId])
    },
    getAllIncomingPickups: async (zavod) => {
        return await pool.awaitQuery(`SELECT * FROM forms WHERE (pickup=-1 OR pickup=?) AND isPickup=0`, [zavod]);
    },
    getAllConfirmedPickups: async (zavod) => {
        return await pool.awaitQuery(`SELECT * FROM forms WHERE pickup=? AND isPickup=1`, [zavod]);
    },
    getZavodOffersForUser: async (userId) => {
        return await pool.awaitQuery(`SELECT f1.* 
FROM forms f1
JOIN forms f2 ON f1.last_fid = f2.fid
WHERE f2.created_by = ?
AND f1.type = 2;`, [userId]);
    },
    acceptOfferForClient: async (formId) => {
        const form = await pool.awaitQuery(`SELECT * FROM forms WHERE fid=?`, [formId]);
        await pool.awaitQuery(`UPDATE forms SET status=1, type=1 WHERE fid=?`, [formId]);
        await pool.awaitQuery(`DELETE FROM forms WHERE last_fid=? AND fid!=?`, [form.last_fid, formId])
        await pool.awaitQuery(`DELETE FROM forms WHERE fid=?`, [form.last_fid])
    },
    getBetonName: async (betonId) => {
        return (await pool.awaitQuery(`SELECT * FROM nc WHERE fid=?`,[betonId]))[0]?.name || 'МАРКА НЕ НАЙДЕНА'
    },
    getDriverFormsByFormId: async (formId) => { 
        return (await pool.awaitQuery(`SELECT ttn FROM driver_forms WHERE form_id=?`, [formId]))
    },
    getFormsByZavod: async (zavod) => {
        return await pool.awaitQuery(`SELECT * FROM forms WHERE zavod=? AND type=1 AND (status=1 OR status=2) AND postoyanik=1`, [zavod])
    }
}