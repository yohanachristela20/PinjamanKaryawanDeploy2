import express from "express";
import multer from 'multer'; // Import multer for file upload handling
import path from 'path';
import fs from 'fs';
import csvParser from "csv-parser";
import db from "../config/database.js";
import Plafond from "../models/PlafondModel.js";
import PlafondUpdate from "../models/PlafondUpdateModel.js";
import Pinjaman from "../models/PinjamanModel.js";
import AntreanPengajuan from "../models/AntreanPengajuanModel.js";
import { Sequelize, Op, where } from "sequelize";

import {getPlafond,
        getPlafondById, 
        createPlafond, 
        // updatePlafond, 
        getLastPlafondId,
        // deletePlafond,
        getJumlahPlafond,
} from "../controllers/PlafondController.js"; 

const router = express.Router(); 

const uploadDirectory = './uploads/plafond';

if (!fs.existsSync(uploadDirectory)) {
        fs.mkdirSync(uploadDirectory, {recursive: true});
}  

const storage = multer.diskStorage({
        destination: (req, file, cb) => {
                cb(null, uploadDirectory);
        },
        filename: (req, file, cb) => {
                cb(null, Date.now() + path.extname(file.originalname));
        }
});

const upload = multer({ storage: storage });

router.get('/plafond', getPlafond); 
router.get('/jumlah-plafond', getJumlahPlafond);
router.get('/plafond/:id_plafond', getPlafondById);
router.post('/plafond', createPlafond);  
// router.patch('/plafond/:id_plafond', updatePlafond);
router.get('/plafond/getNextPlafondId', getLastPlafondId);
// router.delete('/plafond/:id_plafond', deletePlafond);

// router.post('/plafond/import-csv', upload.single("csvfile"), (req,res) => {
// if (!req.file) {
//         return res.status(400).json({ success: false, message: 'No file uploaded' });
// }

// const filePath = req.file.path;
// const plafonds = [];

// fs.createReadStream(filePath)
// .pipe(csvParser())
// .on("data", (row) => {
//   plafonds.push({
//     id_plafond: row.id_plafond,
//     tanggal_penetapan: new Date(row.tanggal_penetapan),
//     jumlah_plafond: parseInt(row.jumlah_plafond, 10),
//     keterangan: row.keterangan,
//     createdAt: new Date(row.createdAt),
//     updatedAt: new Date(row.updatedAt)
//   });
  
// })
// .on("end", async () => {
//   try {
//     if (plafonds.length === 0) {
//       throw new Error("Tidak ada data untuk diimpor");
//     }

//     // Menggunakan model Plafond untuk menyimpan data
//     await Plafond.bulkCreate(plafonds);

//     res.status(200).json({
//       success: true,
//       message: "Data berhasil diimpor ke database",
//     });
//   } catch (error) {
//     console.error("Error importing data:", error);
//     res.status(500).json({
//       success: false,
//       message: "Gagal mengimpor data ke database",
//       error: error.message,
//     });
//   } finally {
//     fs.unlinkSync(filePath);
//   }
// })
// .on("error", (error) => {
//   console.error("Error parsing file:", error);
//   res.status(500).json({ success: false, message: "Error parsing file" });
// });

// });

router.post('/plafond/import-csv', upload.single("csvfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const plafonds = [];

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
        plafonds.push({
        id_plafond: row.id_plafond,
        tanggal_penetapan: new Date(row.tanggal_penetapan),
        jumlah_plafond: parseFloat(row.jumlah_plafond),
        keterangan: row.keterangan,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    })
    .on("end", async () => {
      const transaction = await db.transaction();
      try {
        if (plafonds.length === 0) {
          throw new Error("Tidak ada data untuk diimpor");
        }

        // Simpan data plafonds ke database
        await Plafond.bulkCreate(plafonds, { transaction });

        // Total penambahan plafond dari file CSV
        const totalPlafond = plafonds.reduce((sum, item) => sum + item.jumlah_plafond, 0);

        // Ambil plafond terakhir yang tersedia
        const plafondTerakhir = await PlafondUpdate.findOne({
          include: [
            {
              model: Pinjaman,
              as: "UpdatePinjamanPlafond",
              attributes: ["status_pengajuan", "status_transfer"],
              where: { status_pengajuan: "Diterima", status_transfer: "Selesai" },
            },
          ],
          attributes: ["id_pinjaman", "plafond_saat_ini"],
          order: [["id_pinjaman", "DESC"]],
          raw: true,
          transaction,
        });

        if (!plafondTerakhir) {
          console.log("Data plafond terakhir tidak ditemukan.");
          return res.status(404).json({ success: false, message: "Plafond terakhir tidak ditemukan" });
        }

        let plafondBaru = parseFloat(plafondTerakhir.plafond_saat_ini || 0) + totalPlafond;

        // Update plafond_saat_ini
        await PlafondUpdate.update(
          { plafond_saat_ini: plafondBaru },
          { where: { id_pinjaman: plafondTerakhir.id_pinjaman }, transaction }
        );

        // Ambil antrean pinjaman
        const antreans = await AntreanPengajuan.findAll({
          attributes: ['nomor_antrean', 'id_pinjaman'],
          order: [['nomor_antrean', 'ASC']],
          transaction,
        });

        if (antreans.length > 0) {
          // Ambil detail pinjaman untuk antrean
          const antreanData = await Pinjaman.findAll({
            where: {
              id_pinjaman: { [Op.in]: antreans.map(antrean => antrean.id_pinjaman) },
            },
            attributes: ['id_pinjaman', 'jumlah_pinjaman'],
            transaction,
          });

          const pinjamanMap = new Map(antreanData.map(item => [item.id_pinjaman, item.jumlah_pinjaman]));

          let plafondSaatIni = plafondBaru;

          for (const antrean of antreans) {
            const jumlahPinjamanAntrean = pinjamanMap.get(antrean.id_pinjaman) || 0;

            plafondSaatIni = parseFloat((plafondSaatIni - jumlahPinjamanAntrean).toFixed(2));

            if (plafondSaatIni > 0) {
              let formattedToday = new Date().toISOString().split("T")[0];
              await PlafondUpdate.update(
                {
                  plafond_saat_ini: plafondSaatIni,
                  tanggal_plafond_tersedia: formattedToday,
                },
                { where: { id_pinjaman: antrean.id_pinjaman }, transaction }
              );
            }
          }
        }

        // Commit transaksi jika semua berhasil
        await transaction.commit();

        res.status(200).json({
          success: true,
          message: "Data berhasil diimpor ke database dan plafond diperbarui",
        });
      } catch (error) {
        await transaction.rollback(); // Rollback transaksi jika terjadi kesalahan
        console.error("Error importing data:", error);
        res.status(500).json({
          success: false,
          message: "Gagal mengimpor data ke database",
          error: error.message,
        });
      } finally {
        fs.unlinkSync(filePath); // Hapus file setelah selesai
      }
    })
    .on("error", (error) => {
      console.error("Error parsing file:", error);
      res.status(500).json({ success: false, message: "Error parsing file" });
    });
});



export default router;