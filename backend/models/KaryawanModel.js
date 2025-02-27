import { Sequelize } from "sequelize";
import db from "../config/database.js";

const {DataTypes} = Sequelize;

const Karyawan = db.define('karyawan', {
    id_karyawan: {
        type: DataTypes.INTEGER, 
        primaryKey: true,
    },
    nama: DataTypes.STRING,
    jenis_kelamin: DataTypes.CHAR,
    departemen: DataTypes.STRING,
    divisi: DataTypes.STRING,
    tanggal_lahir: DataTypes.DATEONLY,
    tanggal_masuk: DataTypes.DATEONLY,
    gaji_pokok: DataTypes.DECIMAL(19,2)
}, {
    freezeTableName: true 
}); 

export default Karyawan; 

(async()=> {
    await db.sync();
})(); 