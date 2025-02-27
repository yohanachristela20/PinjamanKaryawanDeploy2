import { Op, Sequelize } from "sequelize";
import db from "../config/database.js";
import Pinjaman from "./PinjamanModel.js";

const { DataTypes } = Sequelize;

const AntreanPengajuan = db.define(
  "antrean_pengajuan",
  {
    id_antrean: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    nomor_antrean: DataTypes.INTEGER,
    id_pinjaman: {
      type: DataTypes.STRING,

      references: {
        model: Pinjaman,
        key: "id_pinjaman",
      },
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    hooks: {
      beforeCreate: async (antrean_pengajuan) => {
        try {
          const lastRecord = await AntreanPengajuan.findOne({
            order: [["nomor_antrean", "DESC"]],
          });

          // Tentukan nomor antrean baru berdasarkan data yang ada
          const newNomorAntrean = lastRecord ? lastRecord.nomor_antrean + 1 : 1;

          // Format ID antrean dengan kombinasi tanggal dan nomor antrean
          const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
          antrean_pengajuan.nomor_antrean = newNomorAntrean;
          antrean_pengajuan.id_antrean = `${today}_${newNomorAntrean}`;
        } catch (error) {
          console.error("Error in beforeCreate hook:", error.message);
          throw error;
        }
      },
    },
  }
);

const resetNomorAntrean = async () => {
  try {
    const antreanData = await AntreanPengajuan.findAll({
      where: {
        status_pengajuan: "Ditunda",
        status_transfer: "Belum Ditransfer",
      },
      order: [["createdAt", "ASC"]],
    });

    let nomorAntrean = 1;

    for (let item of antreanData) {
      await item.update({ nomor_antrean: nomorAntrean });
      nomorAntrean++;
    }

    console.log("Nomor Antrean telah direset.");
  } catch (error) {
    console.error("Terjadi kesalahan saat mereset nomor_antrean:", error.message);
  }
};

const deleteAntreanDiterima = async () => {
  try {
    const deletedData = await AntreanPengajuan.destroy({
      where: {
        [Op.or]: [
          { status_pengajuan: "Diterima" },
          { status_transfer: "Selesai" },
        ],
      },
    });

    console.log(
      `Berhasil menghapus ${deletedData} data antrean yang diterima.`
    );
    // After deletion, reset nomor antrean
    await resetNomorAntrean();
  } catch (error) {
    console.error("Terjadi kesalahan saat menghapus antrean diterima:", error.message);
  }
};

export default AntreanPengajuan;

(async () => {
  try {
    await db.sync();
    console.log("Database synchronized.");
  } catch (error) {
    console.error("Error syncing database:", error.message);
  }
})();